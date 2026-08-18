import json
import os
import uuid


class ArtifactStore:
    def __init__(self, paths):
        self.paths = paths
        self.metadata = {}

    def write(self, wavs, sample_rate):
        try:
            import soundfile as sf
        except ImportError as exc:
            raise RuntimeError("soundfile is not installed") from exc
        artifact_id = str(uuid.uuid4())
        target = self.paths.artifact_path(artifact_id)
        temporary = target.with_suffix(".tmp.wav")
        sf.write(temporary, wavs[0], sample_rate, format="WAV")
        os.replace(temporary, target)
        artifact = {
            "artifactId": artifact_id,
            "mimeType": "audio/wav",
            "sampleRate": sample_rate,
        }
        self.metadata[artifact_id] = artifact
        target.with_suffix(".json").write_text(json.dumps(artifact), encoding="utf-8")
        return artifact

    def get(self, artifact_id):
        artifact = self.metadata.get(artifact_id)
        if artifact is None or not self.paths.artifact_path(artifact_id).is_file():
            raise FileNotFoundError("artifact not found")
        return artifact

    def delete(self, artifact_id):
        self.get(artifact_id)
        self.paths.artifact_path(artifact_id).unlink(missing_ok=True)
        self.paths.artifact_path(artifact_id).with_suffix(".json").unlink(missing_ok=True)
        del self.metadata[artifact_id]
