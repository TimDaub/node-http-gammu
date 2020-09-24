// @format
const express = require("express");
const sqlite = require("better-sqlite3");
const { body, validationResult, query, param } = require("express-validator");
const isgsm7 = require("isgsm7");
const { v4: uuidv4 } = require("uuid");
const createError = require("http-errors");

const { possibleEvents } = require("../constants.js");
const logger = require("../logger.js");
const { outgoing, incoming, webhooks } = require("../controllers/db.js");
let { ENABLED_COUNTRIES } = process.env;
ENABLED_COUNTRIES = ENABLED_COUNTRIES.split(",");
logger.info(
  `Following countries are enabled for receiving/sending SMS: ${ENABLED_COUNTRIES.join(
    ","
  )}`
);

const v1 = express.Router();

v1.post(
  "/outgoing",
  body("receiver").isMobilePhone(ENABLED_COUNTRIES),
  body("text").custom(value => {
    if (!isgsm7(value)) {
      throw new Error("text must be encoded as GSM 7-bit");
    }
    return true;
  }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error("Body is malformed", errors.array());
      return next(createError(400, "Body is malformed"), errors.array());
    }

    const id = uuidv4();
    const msg = {
      receiver: req.body.receiver,
      text: req.body.text,
      id,
      status: "SCHEDULED"
    };

    outgoing.store(msg);
    res.status(202).send({
      id,
      status: "SCHEDULED"
    });
  }
);

v1.get(
  "/incoming",
  query("sender").isMobilePhone(ENABLED_COUNTRIES),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        createError(
          400,
          "Malformed query parameters. Make sure to use encodeURIComponent on phone numbers."
        ),
        errors.array()
      );
    }
    const messages = incoming.list(req.query.sender);
    res.status(200).send(messages);
  }
);

v1.delete("/webhooks/:id", param("id").isUUID(), (req, res, next) => {
  webhooks.remove(req.params.id);
  res.status(200).send();
});

v1.post(
  "/webhooks",
  body("url").isURL({ protocols: ["http", "https"] }),
  body("secret").isLength({ min: 10, max: 64 }),
  body("event").isIn(possibleEvents),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error("Body is malformed", errors.array());
      return next(createError(400, "Body is malformed"), errors.array());
    }

    const webhook = {
      id: uuidv4(),
      url: req.body.url,
      secret: req.body.secret,
      event: req.body.event
    };

    webhooks.store(webhook);
    res.status(201).send(webhook);
  }
);

module.exports = v1;
