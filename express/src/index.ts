import { Bundlesocial, WebhookEvent } from 'bundlesocial';
import express from 'express';
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { Blob } from 'buffer';

dotenv.config();

const app = express();
const port = 3000;

const apiKey = process.env.BUNDLESOCIAL_API_KEY as string;
const secret = process.env.BUNDLESOCIAL_WEBHOOK_SECRET as string;

if (!apiKey) {
  throw new Error('BUNDLESOCIAL_API_KEY is required');
}

if (!secret) {
  throw new Error('BUNDLESOCIAL_WEBHOOK_SECRET is required');
}

app.get('/', (req, res) => {
  res.send('Hello World from bundle.social!');
});

app.get('/health', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);
  const health = await bundlesocial.app.appGetHealth();
  // console.log('health', health);

  res.send(health);
});

app.get('/team', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);
  const team = await bundlesocial.team.teamGetTeam();
  // console.log('team', team);

  res.send(team);
});

app.get('/post', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);

  const video = await fs.readFile('./src/video.mp4');
  const upload = await bundlesocial.upload.uploadCreate({
    formData: {
      file: new Blob([video], { type: 'video/mp4' }),
    },
  });

  const post = await bundlesocial.post.postCreate({
    requestBody: {
      title: 'Hello World',
      status: 'SCHEDULED',
      postDate: new Date().toISOString(),
      socialAccountTypes: ['INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'REDDIT'],
      data: {
        INSTAGRAM: {
          type: 'REEL',
          text: 'Hello World from bundle.social!',
          uploadIds: [upload.id],
        },
        YOUTUBE: {
          type: 'SHORT',
          text: 'Hello World from bundle.social!',
          uploadIds: [upload.id],
        },
        TIKTOK: {
          text: 'Hello World from bundle.social!',
          uploadIds: [upload.id],
        },
        REDDIT: {
          sr: 'r/bundlesocial',
          text: 'Hello World from bundle.social!',
          uploadIds: [upload.id],
        },
      },
    },
  });

  res.send(post);
});

app.post('/webhook', express.json({ type: 'application/json' }), (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);
  const signature = req.headers['x-signature'];

  let event: WebhookEvent;

  try {
    // Verify the webhook signature and return a typed event
    event = bundlesocial.webhooks.constructEvent(
      req.body,
      signature as string,
      secret,
    );
    // Do something with the event
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err);
    return res.sendStatus(400);
  }

  return res.send();
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
