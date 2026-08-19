PROTOCOL_VERSION = 1


class EngineError(Exception):
    def __init__(self, code, message, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


def require(value, name):
    if value is None or value == "":
        raise EngineError("invalid_request", f"{name} is required")
    return value


def require_string(value, name, max_length=None):
    if not isinstance(value, str) or not value.strip():
        raise EngineError("invalid_request", f"{name} must be a non-empty string")
    value = value.strip()
    if max_length is not None and len(value) > max_length:
        raise EngineError("invalid_request", f"{name} is too long")
    return value


def response(request_id, result):
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "type": "response",
        "requestId": request_id,
        "ok": True,
        "result": result,
    }


def error_response(request_id, error):
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "type": "response",
        "requestId": request_id,
        "ok": False,
        "error": {
            "code": error.code,
            "message": error.message,
            "details": error.details,
        },
    }


def event(name, payload):
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "type": "event",
        "event": name,
        "payload": payload,
    }
