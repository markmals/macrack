from macrack.model import Artifact
from macrack.parameters import Envelope
from macrack.rack_interface import block


def device_keepout(name: str, envelope: Envelope, position: tuple[float, float, float]) -> Artifact:
    return Artifact(
        name,
        block(envelope.width, envelope.depth, envelope.height),
        "keepout",
        position,
        f"Envelope only; {envelope.status}; {envelope.source}. Connectors and cables are NOT included.",
    )
