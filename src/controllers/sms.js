//@format
const { EventEmitter } = require("events");
const serialportgsm = require("serialport-gsm");
const { existsSync } = require("fs");

const logger = require("../logger.js");
const { outgoing } = require("./db.js");

const { DEVICE_PATH } = process.env;

class SMSHandler extends EventEmitter {
  constructor(options) {
    super();

    this.modem = serialportgsm.Modem();
    this.sendAll = this.sendAll.bind(this);
    this.send = this.send.bind(this);
    this.receiveAll = this.receiveAll.bind(this);

    if (existsSync(DEVICE_PATH)) {
      this.modem.open(DEVICE_PATH, options);
      this.modem.on("open", () => this.emit("open"));
    } else {
      logger.warn(new Error(`GSM device not found at path: ${DEVICE_PATH}`));
      logger.info("Continuing program execution without GSM device");
    }
  }

  sendAll() {
    logger.info("Attempting to send all messages of type=SCHEDULED.");
    outgoing.popAllMessages("SCHEDULED").forEach(this.send);
  }

  receiveAll() {
    this.modem.getSimInbox((inbox, err) => {
      if (err) {
        logger.error("Hit an error when getting sim inbox", err);
        this.emit("error", err);
      }
      if (inbox && inbox.data && inbox.data.length === 0) {
        // no new messages
        return;
      }

      // NOTE: We filter the original message down to the below listed
      // property names.
      const messages = inbox.data.map(
        ({ sender, message, index, dateTimeSent }) => ({
          sender,
          message,
          index,
          dateTimeSent
        })
      );

      messages.forEach(message => {
        this.modem.deleteMessage(message, (msg, err) => {
          if (err) {
            logger.error(
              "hit error when trying to delete message",
              err,
              message
            );
            this.emit("error", err);
          }

          this.emit("message", message);
        });
      });
    });
  }

  send({ receiver, text, id }) {
    this.modem.sendSMS(receiver, text, false, res => {
      const progress = { ...res.data, id };

      if (res.status === "success") {
        this.emit("progress", progress);
      } else {
        logger.error("hit error when sending sms", progress, id);
        this.emit("error", progress);
      }
    });
  }
}

module.exports = SMSHandler;
