import axios from 'axios';

const checkEvent = async () => {
  try {
    const res = await axios.get('http://localhost:3001/api/events');
    const events = res.data.events;
    if (!events || events.length === 0) {
        console.log("No events found.");
        return;
    }
    events.forEach(e => {
      console.log(`Event: ${e.name}`);
      console.log(`Hosts:`, JSON.stringify(e.hosts, null, 2));
    });
  } catch (err) {
    if (err.response) {
        console.error(`Error ${err.response.status}: ${err.response.data}`);
    } else {
        console.error(err.message);
    }
  }
};

checkEvent();
