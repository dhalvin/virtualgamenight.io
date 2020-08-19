#!/bin/bash
echo "Starting server at port 8080..."
HOSTNAME='ec2-54-215-190-114.us-west-1.compute.amazonaws.com' PORT=8080 CORES=1 node --inspect ~/workspace/virtualgamenight/app.js
