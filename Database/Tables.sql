-- V. 1.0
-- Commands used to create the tables for the MySQL database
-- CREATE DATABASE vgnio;

USE vgnio;

CREATE TABLE Room (
    id VARCHAR(5) NOT NULL,
    expire BIGINT NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE UserRoom (
    userid VARCHAR(6) NOT NULL,
    roomid VARCHAR(5) NOT NULL,
    displayName VARCHAR(64),
    PRIMARY KEY (userid, roomid),
    FOREIGN KEY (roomid) REFERENCES Room(id)
);

CREATE TABLE RoomItems (
    roomid VARCHAR(5) NOT NULL,
    itemid VARCHAR(4) NOT NULL,
    userid VARCHAR(6),
    type VARCHAR(32),
    data TEXT NOT NULL,
    PRIMARY KEY (roomid, itemid),
    FOREIGN KEY (roomid) REFERENCES Room(id)
);

CREATE TABLE Chat (
    roomid VARCHAR(5) NOT NULL,
    userid VARCHAR(6) NOT NULL,
    sentTime BIGINT NOT NULL,
    msg TEXT NOT NULL,
    PRIMARY KEY (roomid, userid, sentTime),
    FOREIGN KEY (roomid) REFERENCES Room(id)
);