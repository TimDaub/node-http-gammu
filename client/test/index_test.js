// @format

const test = require("ava");
const createWorker = require("expressively-mocked-fetch");

const SMSClient = require("../src/index.js");

test("if client can subscribe to webhooks", async t => {
  const bearer = "abc";
  const worker = await createWorker(`
    app.post("/api/v1/webhooks", (req, res) => {
      if (req.get("Authorization") === "Bearer ${bearer}") {
        res.status(201).send(); 
      } else {
        res.status(401).send();
      }
    });
  `);
  const url = `http://localhost:${worker.port}`;
  const client = new SMSClient(url, bearer);

  const wh = {
    url: "https://example.com",
    secret: "aaaaaaaaaa",
    event: "incomingMessage"
  };
  const res = await client.subscribe(wh);
  t.assert(res.status === 201);
});

test("if a client can unsubscribe from webhooks by deleting", async t => {
  const bearer = "abc";
  const id = "webhookdID";
  const worker = await createWorker(`
    app.delete("/api/v1/webhooks/${id}", (req, res) => {
      if (req.get("Authorization") === "Bearer ${bearer}") {
        res.status(201).send();
      } else {
        res.status(401).send();
      }
    });
  `);
  const url = `http://localhost:${worker.port}`;
  const client = new SMSClient(url, bearer);

  const res = await client.unsubscribe(id);
  t.assert(res.status === 201);
});

test("if a client can send sms", async t => {
  const bearer = "abc";
  const msg = {
    receiver: "0123456789",
    text: "a test"
  };
  const worker = await createWorker(`
    app.post("/api/v1/outgoing", (req, res) => {
      if (req.get("Authorization") === "Bearer ${bearer}") {
        if (req.body.receiver === "${msg.receiver}"
        && req.body.text === "${msg.text}") {
          res.status(202).send();
        } else {
          res.status(400).send();
        }
      } else {
        res.status(401).send();
      }
    });
  `);

  const url = `http://localhost:${worker.port}`;
  const client = new SMSClient(url, bearer);

  const res = await client.send(msg.receiver, msg.text);
  t.assert(res.status === 202);
});
