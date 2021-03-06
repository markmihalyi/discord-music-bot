import ytdl from 'ytdl-core';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import logger from '../config/logger.js';

// TODO: /pause

const NAMESPACE = 'AudioPlayer';

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause,
  },
});

// Visszaadja a lejátszó állapotát
const getPlayerStatus = () => player.state.status;

var connectionActive;

// Visszaadja bool-ként, hogy megy-e éppen zene
const isConnectionActive = () => connectionActive;

let connection;
let guildId;

// Csatlakozás a hangcsatornához
const connect = (connectionData) => {
  connection = joinVoiceChannel({
    channelId: connectionData.channelId,
    guildId: connectionData.guildId,
    adapterCreator: connectionData.adapterCreator,
  });

  guildId = connectionData.guildId;

  if (!connectionActive) {
    logger.info(
      NAMESPACE,
      connectionData.guildId,
      `A bot csatlakozott egy hangcsatornához. (ID: ${connectionData.channelId})`
    );
  }

  connectionActive = true;
  return connection.subscribe(player);
};

const queue = new Map();

// Visszaadja hány zene van a lejátszási listában
const getQueueSize = () => queue.size;

var resource;

// A soron következő zene lejátszása, ha van zene a listában
const playQueue = () => {
  if (queue.size > 0) {
    connectionActive = true;
    const data = queue.entries().next();
    const url = data.value[1].url;
    const stream = ytdl(url, { filter: 'audioonly' });
    resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    player.play(resource);

    logger.info(NAMESPACE, guildId, `A következő zene elindult. (Link: ${url})`);

    queue.delete(data.value[0]);
    return true;
  }
  return false;
};

// Zene hozzáadása a lejátszási listához
const addToQueue = (id, username, url) => {
  queue.set(id, { user: username, url: url });
  logger.info(
    NAMESPACE,
    guildId,
    `${username} hozzadott egy zenét a lejátszási listához. (Link: ${url})`
  );

  // Csak akkor indítsa el a következő zenét, ha nem megy semmi éppen
  if (player.state.status == 'idle') {
    playQueue();
  }
};

// Az aktuális zene szüneteltetése
const pause = (username) => {
  logger.info(NAMESPACE, guildId, `A most játszott zenét ${username} szüneteltette.`);
  return player.pause(true);
};

const unpause = (username) => {
  logger.info(NAMESPACE, guildId, `A zene lejátszása folytatódik, ${username} által.`);
  return player.unpause();
};

// Az aktuális zene átugrása
const skip = (username) => {
  logger.info(NAMESPACE, guildId, `${username} átugrotta a most játszott zenét.`);
  return playQueue();
};

// Zene megállítása - /stop
const stop = (username, skipped = false) => {
  player.stop();
  connectionActive = false;
  connection.destroy();

  if (skipped) {
    return logger.info(NAMESPACE, guildId, `${username} átugrotta a most játszott zenét.`);
  }
  return logger.info(NAMESPACE, guildId, `${username} megállította a zene lejátszását.`);
};

// Ha nincs zene lejátszva 30 másodpercig, automatikusan kilép
player.on(AudioPlayerStatus.Idle, () => {
  // Ha van a lejátszási listában valami, akkor induljon el
  if (playQueue()) return;

  connectionActive = false;
  setTimeout(() => {
    logger.info(NAMESPACE, guildId, 'A bot inaktivitás miatt lecsatlakozott.');
    return connection.destroy();
  }, 30_000);
});

export default {
  getPlayerStatus: getPlayerStatus,
  isConnectionActive: isConnectionActive,
  getQueueSize: getQueueSize,
  connect: connect,
  addToQueue: addToQueue,
  pause: pause,
  unpause: unpause,
  skip: skip,
  stop: stop,
};
