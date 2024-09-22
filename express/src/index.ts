import { Bundlesocial, WebhookEvent, ApiError } from 'bundlesocial';
import express from 'express';
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { Blob } from 'buffer';

dotenv.config();

const app = express();
const port = 3000;

const apiKey = process.env.BUNDLESOCIAL_API_KEY as string;
const secret = process.env.BUNDLESOCIAL_WEBHOOK_SECRET as string;

let teamId: string;

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

  try {
    const health = await bundlesocial.app.appGetHealth();

    res.send(health);
  } catch (error: unknown) {
    console.log(error);

    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/organization', async (req, res) => {
  try {
    const bundlesocial = new Bundlesocial(apiKey);
    const organization =
      await bundlesocial.organization.organizationGetOrganization();

    teamId = organization?.teams?.[0]?.id;

    res.send(organization);
  } catch (error: unknown) {
    console.log(error);

    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/create-team', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);

  try {
    const team = await bundlesocial.team.teamCreateTeam({
      requestBody: {
        name: 'My Team',
        tier: 'FREE',
      },
    });

    teamId = team.id;

    res.send(team);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/team', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);
  try {
    const team = await bundlesocial.team.teamGetTeam({
      id: teamId,
    });

    res.send(team);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/social-account-connect', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);

  try {
    const response = await bundlesocial.socialAccount.socialAccountConnect({
      requestBody: {
        teamId,
        type: 'TIKTOK',
        redirectUrl: 'http://localhost:3000',
      },
    });

    res.send(response);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/social-account-select-channel', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);

  // After connecting the account, you need to select a channel for some of the platforms
  // you can find the channel id by getting a team, finding the
  // (required for FACEBOOK, INSTAGRAM, YOUTUBE and LINKEDIN)

  try {
    const team = await bundlesocial.team.teamGetTeam({
      id: teamId,
    });

    const socialAccount = team?.socialAccounts?.find(
      (account) => account.type === 'YOUTUBE',
    );

    if (!socialAccount) {
      res.status(400).send('No social account found');
      return;
    }

    const socialAccountChannelId = socialAccount?.channels?.[0]?.id;

    if (socialAccountChannelId) {
      const response = await bundlesocial.socialAccount.socialAccountSetChannel(
        {
          requestBody: {
            type: 'YOUTUBE',
            teamId: team.id,
            channelId: socialAccountChannelId,
          },
        },
      );

      res.send(response);
    } else {
      res.status(400).send('No channel found');
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/post', async (req, res) => {
  const bundlesocial = new Bundlesocial(apiKey);

  try {
    const video = await fs.readFile('./src/video.mp4');
    const upload = await bundlesocial.upload.uploadCreate({
      formData: {
        teamId,
        file: new Blob([video], { type: 'video/mp4' }),
      },
    });

    const post = await bundlesocial.post.postCreate({
      requestBody: {
        teamId,
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
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      res.status(500).send(error);
    } else {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  }
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
