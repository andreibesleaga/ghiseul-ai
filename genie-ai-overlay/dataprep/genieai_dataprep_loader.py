# Copyright (C) 2025 International Telecommunication Union (ITU)
# SPDX-License-Identifier: Apache-2.0


import os

from comps import CustomLogger
from opea_dataprep_loader import OpeaDataprepLoader

logger = CustomLogger("genie_dataprep_loader")
logflag = os.getenv("LOGFLAG", False)


class GenieDataprepLoader(OpeaDataprepLoader):
    """
    A custom GENIE.AI loader extending OPEA dataprep loader.
    Forwards Genie-specific methods to the GenieArangoDataprep component.
    """
    async def ingest_data_to_arango_with_guardrail(self, *args, **kwargs):
        if logflag:
            logger.info("[ dataprep loader ] ingest file with guardrail")
        return await self.component.ingest_file_with_guardrail(*args, **kwargs)
    
    async def ingest_file_with_guardrail(self, *args, **kwargs):
        """Alias for ingest_data_to_arango_with_guardrail to match microservice interface."""
        if logflag:
            logger.info("[ dataprep loader ] ingest file with guardrail (alias)")
        return await self.component.ingest_file_with_guardrail(*args, **kwargs)
    
    async def retract_file(self, *args, **kwargs):
        if logflag:
            logger.info("[ dataprep loader ] retract files")
        return await self.component.retract_file(*args, **kwargs)

