use crate::http_api::routes::{error_response, ApiState};
use axum::{
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::Response,
};
use std::time::{Duration, Instant};

const RATE_LIMIT: u32 = 100;
const RATE_WINDOW: Duration = Duration::from_secs(60);

pub struct RateLimiter {
    window_start: Instant,
    count: u32,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            window_start: Instant::now(),
            count: 0,
        }
    }

    fn allow(&mut self) -> bool {
        if self.window_start.elapsed() >= RATE_WINDOW {
            self.window_start = Instant::now();
            self.count = 0;
        }
        if self.count >= RATE_LIMIT {
            false
        } else {
            self.count += 1;
            true
        }
    }
}

pub async fn auth_middleware(
    State(state): State<ApiState>,
    request: Request,
    next: Next,
) -> Response {
    let allowed = state
        .rate
        .lock()
        .map(|mut limiter| limiter.allow())
        .unwrap_or(false);
    if !allowed {
        return error_response(StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded");
    }

    let method = request.method().clone();
    let is_write = !(method == Method::GET
        || method == Method::HEAD
        || method == Method::OPTIONS);

    if is_write && !state.allow_write {
        return error_response(
            StatusCode::FORBIDDEN,
            "Write operations are disabled for this API",
        );
    }

    if !state.api_key.is_empty() {
        let provided = provided_api_key(&request);
        if provided.as_deref() != Some(state.api_key.as_str()) {
            return error_response(StatusCode::UNAUTHORIZED, "Invalid or missing API key");
        }
    } else if is_write {
        return error_response(
            StatusCode::FORBIDDEN,
            "An API key is required for write operations",
        );
    }

    next.run(request).await
}

fn provided_api_key(request: &Request) -> Option<String> {
    if let Some(value) = request
        .headers()
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
    {
        return Some(value.to_string());
    }

    request.uri().query().and_then(|query| {
        query.split('&').find_map(|pair| {
            let (key, value) = pair.split_once('=')?;
            if key == "api_key" {
                urlencoding::decode(value)
                    .ok()
                    .map(|decoded| decoded.into_owned())
            } else {
                None
            }
        })
    })
}
