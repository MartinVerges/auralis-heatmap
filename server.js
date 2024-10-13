require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const socketIo = require('socket.io');

// Setup express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MQTT broker URL from .env
const brokerUrl = process.env.MQTT_BROKER_URL;

if (!brokerUrl) {
    console.error("Error: MQTT_BROKER_URL is not defined in .env");
    process.exit(1); // Exit the process if no broker URL is found
}

// Log MQTT Broker URL for debugging
console.log(`Attempting to connect to MQTT broker at: ${brokerUrl}`);

// MQTT client setup
const mqttClient = mqtt.connect(brokerUrl, {
    reconnectPeriod: 10*1000, // Try reconnecting every 10 seconds
});

// Mapping MQTT topics to heatmap points
const topics = [
    process.env.POINT_1_TOPIC,
    process.env.POINT_2_TOPIC,
    process.env.POINT_3_TOPIC,
    process.env.POINT_4_TOPIC,
    process.env.POINT_5_TOPIC,
    process.env.POINT_6_TOPIC,
    process.env.POINT_7_TOPIC,
    process.env.POINT_8_TOPIC,
    process.env.POINT_9_TOPIC,
    process.env.POINT_10_TOPIC,
];

// Array to store temperatures
const temperatures = new Array(topics.length).fill(null);  // Standardwerte für die Punkte
const humidities = new Array(topics.length).fill(null);  // Standardwerte für die Punkte
const timers = new Array(topics.length).fill(null);  // Timer für jeden Punkt
const MQTT_TIMEOUT = 31*60*1000;  // 31 Minuten, um die Punkte auszublenden 

// Check if topics are defined
topics.forEach((topic, index) => {
    if (!topic) {
        console.warn(`Warning: POINT_${index + 1}_TOPIC is not defined in .env`);
    }
});

// Funktion, um einen Punkt unsichtbar zu machen
function hidePoint(index) {
    temperatures[index] = null;  // Setze den Wert auf 0 (unsichtbar)
    io.emit('temperatureUpdate', { index, temp: null });  // Update an den Client senden
}

// Log when MQTT connection is successful
mqttClient.on('connect', () => {
    console.log('MQTT connection successful.');

    // Subscribe to MQTT topics
    topics.forEach((topic, index) => {
        if (topic) {
            ['temperature', 'humidity'].forEach((subTopic) => {
                mqttClient.subscribe(topic+"/"+subTopic, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${topic}/${subTopic}:`, err.message);
                    } else {
                        console.log(`Successfully subscribed to topic ${topic}/${subTopic}.`);
                    }
                });
            });
        }
    });
});

// Log if the connection is lost or an error occurs
mqttClient.on('error', (err) => {
    console.error('MQTT connection error:', err.message);
});

// Log if the MQTT client reconnects
mqttClient.on('reconnect', () => {
    console.log('Attempting to reconnect to the MQTT broker...');
});

// Log if the MQTT client goes offline
mqttClient.on('offline', () => {
    console.warn('MQTT client went offline.');
});

// Handle MQTT message events
mqttClient.on('message', (receivedTopic, message) => {
    const data = parseFloat(message.toString());
    const topicIndex = topics.indexOf(receivedTopic.substring(0, receivedTopic.lastIndexOf("/")));

    if (topicIndex !== -1) {
        console.log(`Received message from ${receivedTopic}: ${data}`);

        // Temperatur aktualisieren und an den Client senden
        if (receivedTopic.endsWith('temperature')) {
            temperatures[topicIndex] = data;
            io.emit('temperatureUpdate', { index: topicIndex, data });
        } else if (receivedTopic.endsWith('humidity')) {
            humidities[topicIndex] = data;
            io.emit('humidityUpdate', { index: topicIndex, data });    
        }

        // Vorhandenen Timer stoppen, wenn Daten ankommen
        if (timers[topicIndex]) {
            clearTimeout(timers[topicIndex]);
        }

        // Neuen Timer setzen, um den Punkt nach einer bestimmten Zeit auszublenden
        timers[topicIndex] = setTimeout(() => {
            hidePoint(topicIndex);
        }, MQTT_TIMEOUT);
    } else {
        console.warn(`Received message from unknown topic ${receivedTopic}`);
    }
});

io.on('connection', (socket) => {
    socket.on('hello', () => {
        console.log(`New client connected`);
        temperatures.forEach((data, key) => {
            console.log(`Send known temperature ${key}: ${data}°C`);
            io.emit('temperatureUpdate', { index: key, temp: data });
        });
        humidities.forEach((data, key) => {
            console.log(`Send known humidity ${key}: ${data}°C`);
            io.emit('humidityUpdate', { index: key, humidity: data });
        });
    });
});

// Serve static files from the "public" directory
app.use(express.static('public'));

// Start the server and log the status
server.listen(process.env.PORT, () => {
    console.log(`Server is running and listening on http://localhost:${process.env.PORT}`);
});
