from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from app.security import AIRequestContext, get_ai_context
from app.transcript_analysis import analyze_call_transcript


class TranscriptAnalysisRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=80_000)


app = FastAPI(
    title="Dakini CRM — Layer 5 Transcript Analysis",
    description=(
        "Analyzes a sales-call transcript once and returns two outputs: "
        "Summary and Improvements. AI outputs are not persisted."
    ),
    version="2.0.0",
)


@app.get("/health", tags=["health"])
async def health():
    # This service does not use the CRM database. Its only external dependency
    # for analysis is the configured hosted LLM provider.
    return {"status": "ok", "service": "layer5-transcript-analysis"}


@app.post(
    "/v1/ai/transcript-analysis",
    tags=["transcript analysis"],
    summary="Generate Summary and Improvements from a call transcript",
)
async def transcript_analysis(
    body: TranscriptAnalysisRequest,
    ctx: AIRequestContext = Depends(get_ai_context),
):
    # ctx is intentionally required to enforce Layer 3's trusted identity and
    # internal service key. This endpoint does not save inputs or outputs.
    outputs = await analyze_call_transcript(body.transcript)
    return {"status": "success", "outputs": outputs, "persisted": False}
