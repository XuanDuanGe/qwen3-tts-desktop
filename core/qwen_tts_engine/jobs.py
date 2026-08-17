import queue
import threading
import uuid


class JobQueue:
    def __init__(self, handler, emit):
        self.handler = handler
        self.emit = emit
        self.jobs = {}
        self.pending = queue.Queue()
        self.stop_event = threading.Event()
        self.worker = threading.Thread(target=self._run, daemon=True)
        self.worker.start()

    def submit(self, params):
        job_id = str(uuid.uuid4())
        job = {"jobId": job_id, "status": "queued", "progress": 0}
        self.jobs[job_id] = {"data": job, "params": params, "cancelled": False}
        self.pending.put(job_id)
        self.emit("job.updated", job)
        return job

    def get(self, job_id):
        try:
            return self.jobs[job_id]["data"]
        except KeyError as exc:
            raise ValueError("job not found") from exc

    def cancel(self, job_id):
        try:
            item = self.jobs[job_id]
        except KeyError as exc:
            raise ValueError("job not found") from exc
        item["cancelled"] = True
        if item["data"]["status"] == "queued":
            item["data"]["status"] = "cancelled"
            self.emit("job.updated", item["data"])
        return item["data"]

    def close(self):
        self.stop_event.set()
        self.pending.put(None)
        self.worker.join(timeout=5)

    def _run(self):
        while not self.stop_event.is_set():
            job_id = self.pending.get()
            if job_id is None:
                return
            item = self.jobs[job_id]
            if item["cancelled"]:
                continue
            try:
                self._update(item, "preparing", 0.1)
                result = self.handler(item["params"], item)
                self._update(item, "succeeded", 1, result)
            except Exception as exc:
                status = "cancelled" if str(exc) == "cancelled" else "failed"
                item["data"].update({"status": status, "error": str(exc)})
                self.emit("job.updated", item["data"])

    def _update(self, item, status, progress, result=None):
        item["data"].update({"status": status, "progress": progress})
        if result is not None:
            item["data"]["result"] = result
        self.emit("job.updated", item["data"])
