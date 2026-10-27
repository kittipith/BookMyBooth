from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

from shared.http import create_app

logger = Logger()
app = create_app()


@app.get("/health")
def health():
    return {"status": "ok"}


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
