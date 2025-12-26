const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// Serveeri kõik failid samast kaustast
app.use(express.static(__dirname));

// Kui keegi läheb juur-URLile, anna index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server kuulab http://localhost:${PORT}`);
});



