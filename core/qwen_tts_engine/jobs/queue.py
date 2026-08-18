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
        job = {
            "jobId": job_id,
            "status": "queued",
            "stage": "waiting",
            "message": "正在等待前序任务",
            "progress": 0,
        }
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
            self._update(item, "cancelled", item["data"]["progress"], "cancelled", "任务已取消")
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
                result = self.handler(item["params"], item, self._progress(item))
                self._update(item, "succeeded", 1, "completed", "生成完成", result)
            except Exception as exc:
                status = "cancelled" if str(exc) == "cancelled" else "failed"
                stage = "cancelled" if status == "cancelled" else "failed"
                message = "任务已取消" if status == "cancelled" else f"生成失败：{exc}"
                self._update(
                    item,
                    status,
                    item["data"]["progress"],
                    stage,
                    message,
                    error=str(exc),
                )

    def _progress(self, item):
        def update(status, progress, stage, message):
            self._update(item, status, progress, stage, message)

        return update

    def _update(self, item, status, progress, stage, message, result=None, error=None):
        item["data"].update(
            {
                "status": status,
                "stage": stage,
                "message": message,
                "progress": progress,
            }
        )
        if result is not None:
            item["data"]["result"] = result
        if error is not None:
            item["data"]["error"] = error
        self.emit("job.updated", item["data"])
