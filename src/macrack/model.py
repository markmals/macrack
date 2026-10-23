from dataclasses import dataclass

from build123d import Shape


@dataclass(frozen=True)
class Artifact:
    name: str
    shape: Shape
    kind: str = "printable"
    position: tuple[float, float, float] = (0, 0, 0)
    note: str = ""

    def placed(self) -> Shape:
        return self.shape.translate(self.position)
