"""API blueprints package."""
from .health import HealthBlueprint
from .box_config import BoxConfigBlueprint
from .image_processor import ImageProcessorBlueprint

__all__ = ["HealthBlueprint", "BoxConfigBlueprint", "ImageProcessorBlueprint"]