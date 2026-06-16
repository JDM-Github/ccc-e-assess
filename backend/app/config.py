import os
from jdm_electron_flask import JDMDevelopmentConfig, JDMProductionConfig, JDMDeployedConfig

class _AppConfig:
    """Shared app-level fields across all environments."""
    MAX_WORKERS     = int(os.getenv("MAX_WORKERS", "2"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))

class DevelopmentConfig(_AppConfig, JDMDevelopmentConfig): pass
class ProductionConfig(_AppConfig, JDMProductionConfig):   pass
class DeployedConfig(_AppConfig, JDMDeployedConfig):       pass
