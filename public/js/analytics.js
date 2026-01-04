// Bay Area Golf Analytics Tracking
(function() {
  const track = (eventType, eventData = {}, courseId = null) => {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        event_data: eventData,
        page_url: window.location.pathname,
        course_id: courseId
      })
    }).catch(() => {}); // Silently fail
  };

  // Track page view on load
  window.addEventListener('load', () => {
    track('page_view', { referrer: document.referrer });
  });

  // Expose tracking functions globally
  window.BayAreaGolfAnalytics = {
    trackPageView: () => track('page_view', { referrer: document.referrer }),
    trackCourseView: (courseId, courseName) => track('course_view', { course_name: courseName }, courseId),
    trackTeeTimeView: (courseId, date) => track('tee_time_view', { date }, courseId),
    trackBookingClick: (courseId, courseName, price) => track('booking_click', { course_name: courseName, price }, courseId),
    trackSearch: (query, resultsCount, filters = {}) => {
      fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, results_count: resultsCount, filters })
      }).catch(() => {});
    }
  };
})();
