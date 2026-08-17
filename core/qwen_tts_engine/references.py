import shutil
import uuid


class ReferenceStore:
    def __init__(self, paths):
        self.paths = paths
        self.references = {}

    def put(self, source_path):
        source = source_path.resolve()
        if not source.is_file():
            raise FileNotFoundError("reference audio not found")
        reference_id = str(uuid.uuid4())
        target = self.paths.reference_path(reference_id)
        target.mkdir(parents=True)
        audio_path = target / source.name
        shutil.copy2(source, audio_path)
        self.references[reference_id] = audio_path
        return {"referenceAudioId": reference_id}

    def resolve(self, reference_id):
        try:
            return self.references[reference_id]
        except KeyError as exc:
            raise FileNotFoundError("reference audio not found") from exc

    def delete(self, reference_id):
        path = self.resolve(reference_id)
        shutil.rmtree(path.parent, ignore_errors=True)
        del self.references[reference_id]
