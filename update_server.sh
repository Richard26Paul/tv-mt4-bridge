#!/bin/bash

# Update the server.js to serve the complete EA file
sed -i '/app.get(.\\/api\\/generate-ea/,/res.send(/c\
app.get(\x27/api/generate-ea\x27, (req, res) => {\
  const fs = require(\x27fs\x27);\
  const eaPath = path.join(__dirname, \x27TradingViewBridge_EA.mq4\x27);\
  if (fs.existsSync(eaPath)) {\
    const eaCode = fs.readFileSync(eaPath, \x27utf8\x27);\
    res.setHeader(\x27Content-Type\x27, \x27application/x-mq4\x27);\
    res.setHeader(\x27Content-Disposition\x27, \x27attachment; filename="TradingViewBridge_EA.mq4"\x27);\
    res.send(eaCode);\
  } else {\
    res.status(404).send(\x27EA file not found. Please generate it first.\x27);\
  }\
});' server.js

echo "Server updated!"
