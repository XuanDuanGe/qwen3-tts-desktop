import json
import os
import time
import uuid
from datetime import datetime


class ArtifactStore:
    def __init__(self, paths):
        self.paths = paths
        self.metadata = {}
        self._load_existing()

    def _load_existing(self):
        for meta_path in sorted(self.paths.outputs.glob('*.json')):
            try:
                payload = json.loads(meta_path.read_text(encoding='utf-8'))
            except Exception:
                continue
            artifact_id = payload.get('artifactId')
            file_name = payload.get('fileName') or f'{artifact_id}.wav'
            if not artifact_id or not file_name:
                continue
            audio_path = self.paths.artifact_audio_path(file_name)
            if not audio_path.is_file():
                continue
            created_at = payload.get('createdAt')
            if not isinstance(created_at, (int, float)):
                created_at = audio_path.stat().st_mtime
            artifact = {
                'artifactId': artifact_id,
                'fileName': file_name,
                'mimeType': payload.get('mimeType', 'audio/wav'),
                'sampleRate': payload.get('sampleRate'),
                'createdAt': created_at,
            }
            self.metadata[artifact_id] = artifact

    def _next_file_name(self):
        file_name = datetime.now().strftime('%Y-%m-%d-%H-%M-%S.wav')
        while self.paths.artifact_audio_path(file_name).exists():
            time.sleep(1)
            file_name = datetime.now().strftime('%Y-%m-%d-%H-%M-%S.wav')
        return file_name

    def _resolve_audio_path(self, artifact):
        return self.paths.artifact_audio_path(artifact['fileName'])

    def write(self, wavs, sample_rate):
        try:
            import soundfile as sf
        except ImportError as exc:
            raise RuntimeError('soundfile is not installed') from exc
        artifact_id = str(uuid.uuid4())
        file_name = self._next_file_name()
        target = self.paths.artifact_audio_path(file_name)
        temporary = target.with_suffix('.tmp.wav')
        sf.write(temporary, wavs[0], sample_rate, format='WAV')
        os.replace(temporary, target)
        artifact = {
            'artifactId': artifact_id,
            'fileName': file_name,
            'mimeType': 'audio/wav',
            'sampleRate': sample_rate,
            'createdAt': datetime.now().timestamp(),
        }
        self.metadata[artifact_id] = artifact
        self.paths.artifact_json_path(artifact_id).write_text(
            json.dumps(artifact, ensure_ascii=False),
            encoding='utf-8',
        )
        return artifact

    def list(self):
        artifacts = list(self.metadata.values())
        artifacts.sort(key=lambda item: item.get('createdAt') or 0, reverse=True)
        return artifacts

    def get(self, artifact_id):
        artifact = self.metadata.get(artifact_id)
        if artifact is None:
            raise FileNotFoundError('artifact not found')
        if not self._resolve_audio_path(artifact).is_file():
            raise FileNotFoundError('artifact not found')
        return artifact

    def delete(self, artifact_id):
        artifact = self.get(artifact_id)
        self._resolve_audio_path(artifact).unlink(missing_ok=True)
        self.paths.artifact_json_path(artifact_id).unlink(missing_ok=True)
        del self.metadata[artifact_id]
