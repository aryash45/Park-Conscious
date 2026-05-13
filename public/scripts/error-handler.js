/**
 * Unified Error Handler for Park Conscious Main Website
 * Catches unhandled JS errors and reports them to the centralized logging API.
 */
(function() {
    const API_URL = '/api/admin/logs';
    
    function reportError(data) {
        try {
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'web',
                    type: data.type || 'frontend_error',
                    message: data.message || 'Unknown Web Error',
                    stack: data.stack || '',
                    url: window.location.href,
                    metadata: data.metadata || {}
                })
            }).catch(e => console.warn('Monitoring: Report failed', e));
        } catch (e) {
            // Silently fail to avoid recursion if fetch itself throws
        }
    }

    // Capture JS Runtime Errors
    window.onerror = function(message, source, lineno, colno, error) {
        reportError({
            type: 'frontend_runtime_error',
            message: message,
            stack: error ? error.stack : `At ${source}:${lineno}:${colno}`,
            metadata: { source, lineno, colno }
        });
        return false; // Let default browser handler run
    };

    // Capture Unhandled Promise Rejections
    window.onunhandledrejection = function(event) {
        reportError({
            type: 'promise_rejection',
            message: event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Rejection',
            stack: event.reason ? event.reason.stack : '',
            metadata: { reason: String(event.reason) }
        });
    };

    console.log('System Monitoring Active: Park Conscious Web Platform');
})();
