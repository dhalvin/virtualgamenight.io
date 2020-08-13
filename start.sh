#!/bin/bash
echo "Starting server at port 8080..."
HOSTNAME='ec2-54-215-190-114.us-west-1.compute.amazonaws.com' PORT=8080 CORES=4 node ~/workspace/virtualgamenight/app.js
