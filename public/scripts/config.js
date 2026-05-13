window.PARK_CONFIG = {
    MAPS_KEY: "",
    MAPBOX_KEY: "", // Optional secondary fallback
    ROUTING_API_URL: "http://localhost:8000",
    getDmieUrl: function() {
        // Pointing to production by default so local testing works without the Python engine
        return "https://dmie.parkconscious.in/api/v1";
    }
};