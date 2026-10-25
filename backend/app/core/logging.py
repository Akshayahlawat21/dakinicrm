import logging
import re
from typing import Optional

class CorrelationFilter(logging.Filter):
    """Injects correlation_id into log records."""
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "-"
        return True


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.addFilter(CorrelationFilter())
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] [cid=%(correlation_id)s] [%(name)s] %(message)s"
            )
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
