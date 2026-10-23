import tomllib
from dataclasses import asdict, dataclass, fields, replace
from math import isfinite
from pathlib import Path


@dataclass(frozen=True)
class Envelope:
    width: float
    depth: float
    height: float
    source: str
    status: str

    def validate(self, name: str) -> None:
        for axis in ("width", "depth", "height"):
            number = getattr(self, axis)
            if isinstance(number, bool) or not isinstance(number, (float, int)):
                raise ValueError(f"{name}.{axis} must be a finite positive millimeter value")
            if not isfinite(number) or number <= 0:
                raise ValueError(f"{name}.{axis} must be a finite positive millimeter value")
        if (
            not isinstance(self.source, str)
            or not self.source.strip()
            or not isinstance(self.status, str)
            or self.status not in {"manufacturer-confirmed", "physical-measurement", "provisional"}
        ):
            raise ValueError(f"{name} needs source and recognized status")


@dataclass(frozen=True)
class Design:
    # Design allowances, not measured hardware dimensions; all lengths are mm.
    floor: float = 3.0
    side_wall: float = 3.0
    clearance: float = 1.0
    device_front: float = 4.0
    stand_off: float = 3.0
    top_clearance: float = 4.0
    hdd_feet: float = 8.0
    vent_width: float = 8.0
    vent_pitch: float = 16.0
    strap_width: float = 5.0
    strap_length: float = 12.0
    nvme_units: int = 1
    sata_units: int = 1
    hdd_units: int = 2

    def validate(self) -> None:
        for field in fields(self):
            number = getattr(self, field.name)
            if isinstance(number, bool) or not isinstance(number, (int, float)):
                raise ValueError(f"design.{field.name} must be numeric")
            if not isfinite(number) or number <= 0:
                raise ValueError(f"design.{field.name} must be finite and positive")
        for name in ("nvme_units", "sata_units", "hdd_units"):
            if type(getattr(self, name)) is not int or getattr(self, name) not in (1, 2, 3):
                raise ValueError(f"{name} must select an original 1U, 2U or 3U template")
        if not 2.4 <= self.floor <= 6 or not 3 <= self.side_wall <= 8:
            raise ValueError("floor must be 2.4..6 and side_wall 3..8 mm")
        if self.vent_width + 4 > self.vent_pitch:
            raise ValueError("Vent webs must be at least 4 mm")
        if self.strap_width > 8 or self.strap_length > 20:
            raise ValueError("strap slots exceed the supported carrier geometry")


@dataclass(frozen=True)
class Parameters:
    design: Design = Design()
    sata: Envelope = Envelope(
        69.85,
        100.0,
        6.8,
        "Samsung 870 QVO datasheet; reference only until exact owner model is confirmed",
        "provisional",
    )
    hdd: Envelope = Envelope(
        101.854,
        147.0,
        26.11,
        "Seagate ST12000NT001 manual 206815300 Rev B; screening envelope, NOT a selected drive",
        "provisional",
    )
    mac: Envelope = Envelope(
        127.0,
        127.0,
        50.0,
        "https://support.apple.com/en-us/121555; original M4 cradle reference only",
        "provisional",
    )
    nvme: Envelope | None = None

    def validate(self) -> None:
        self.design.validate()
        for name in ("sata", "hdd", "mac", "nvme"):
            envelope = getattr(self, name)
            if envelope is not None:
                envelope.validate(name)
        if self.design.hdd_feet < 4:
            raise ValueError("HDD feet must retain at least 4 mm of support depth")

    def metadata(self) -> dict:
        return asdict(self)


def load_parameters(path: Path | None = None) -> Parameters:
    parameters = Parameters()
    if path is not None:
        with path.open("rb") as stream:
            settings = tomllib.load(stream)
        unknown = set(settings) - {field.name for field in fields(parameters)}
        if unknown:
            raise ValueError(f"Unknown configuration sections: {sorted(unknown)}")
        for name, changes in settings.items():
            if not isinstance(changes, dict):
                raise ValueError(f"{name} must be a TOML table")
            current = getattr(parameters, name)
            try:
                updated = Envelope(**changes) if current is None else replace(current, **changes)
            except TypeError as error:
                raise ValueError(f"Invalid {name} configuration: {error}") from error
            parameters = replace(parameters, **{name: updated})
    parameters.validate()
    return parameters
