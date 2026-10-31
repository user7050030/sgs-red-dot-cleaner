// ==UserScript==
// @name         三国杀·去红点与新标
// @namespace    https://github.com/user7050030/sgs-red-dot-cleaner/upload/main
// @version      1.0.0
// @description  隐藏大厅、按钮和列表上的红点提示与「新」角标。
// @author       去红点插件(Beta,有一些已知bug)
// @match        https://game.4399iw2.com/yxxsgs/*
// @match        *://*.sanguosha.com/10/*
// @match        *://*.sanguosha.com/x/*
// @match        *://*.sanguosha.com/10th/*
// @match        https://wan.baidu.com/*gameId=19793616*
// @match        *://h5.7k7k.com/web/H5GAMES.html?gid=960982bec2f555de44ea43ca8a7ef418/*
// @match        *://qqgame.qq.com/webappframe/?appid=10951
// @match        *://s118.app1107877410.qqopenapp.com/pc/qqLobby_index.php*
// @match        *://kuaiwan.com/game/main/9496000/*
// @match        *://kuaiwan.com/start/game.html*
// @match        *://sgsszn.wan.360.cn/*
// @exclude      *://*.sanguosha.com/220/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.__SGS_RED_DOT_CLEANER__) return;
  window.__SGS_RED_DOT_CLEANER__ = true;

  const RED = /red[_\-.]?point|redpoint|red[_\-.]?dot|reddot|topredpoint|newfunc_redpoint/i;
  const NEW = /(?:newstylebasenew|newmodebtnnew|newmodesecondbtnnewtag|newmodeshuanneijianflg|newtag|newflag|newicon|newmark)\.(?:png|jpg|jpeg|webp)(?:\?|$)/i;
  const EMPTY_URLS = [
    'https://web.sanguosha.com/10/pc/baseUI/EmptyImg.png',
    'baseUI/EmptyImg.png',
  ];

  const state = { trans: null, installed: false, lastSweep: 0, hits: 0 };

  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch (_) { return fallback; } };

  function textureUrl(tex) {
    if (!tex) return '';
    return safe(() => String(tex.url || tex._url || (tex.source && (tex.source.src || tex.source.url)) || ''), '');
  }

  function isBadge(value) {
    if (!value) return false;
    if (typeof value === 'string') return RED.test(value) || NEW.test(value);
    const url = textureUrl(value);
    return url ? RED.test(url) || NEW.test(url) : false;
  }

  function transparent(Laya) {
    if (state.trans) return state.trans;
    for (const url of EMPTY_URLS) {
      const tex = safe(() => Laya.loader && Laya.loader.getRes(url), null);
      if (tex) { state.trans = tex; return tex; }
    }
    return null;
  }

  function blankCmd(Laya, cmd) {
    if (!cmd) return 0;
    const trans = state.trans;
    let count = 0;
    if (cmd.texture && isBadge(cmd.texture)) { cmd.texture = trans; count++; }
    if (Array.isArray(cmd.textures)) {
      for (let i = 0; i < cmd.textures.length; i++) {
        if (isBadge(cmd.textures[i])) { cmd.textures[i] = trans; count++; }
      }
    }
    return count;
  }

  function sweep(Laya) {
    if (!state.trans || !Laya.stage) return 0;
    let count = 0;
    const walk = node => {
      if (!node) return;
      const cmds = safe(() => node.graphics && node.graphics._cmds, null);
      if (Array.isArray(cmds)) for (const cmd of cmds) count += blankCmd(Laya, cmd);
      const direct = safe(() => node.texture, null);
      if (direct && isBadge(direct)) { safe(() => { node.texture = state.trans; }); count++; }
      for (let i = 0; i < safe(() => node.numChildren, 0); i++) walk(safe(() => node.getChildAt(i), null));
    };
    walk(Laya.stage);
    state.hits += count;
    return count;
  }

  function wrap(Laya) {
    if (state.installed) return;
    const G = safe(() => Laya.Graphics && Laya.Graphics.prototype, null);
    if (!G) return;
    const swap = arg => (isBadge(arg) ? state.trans : arg);
    for (const name of ['drawImage', 'drawTexture', 'draw9Grid', 'fillTexture']) {
      const original = safe(() => G[name], null);
      if (typeof original !== 'function' || original.__jndRedDotWrapped) continue;
      const wrapped = function (texture) {
        if (isBadge(texture)) {
          const args = Array.prototype.slice.call(arguments);
          args[0] = state.trans;
          return original.apply(this, args);
        }
        return original.apply(this, arguments);
      };
      wrapped.__jndRedDotWrapped = true;
      G[name] = wrapped;
    }
    const drawTextures = safe(() => G.drawTextures, null);
    if (typeof drawTextures === 'function' && !drawTextures.__jndRedDotWrapped) {
      const wrapped = function (textures) {
        if (Array.isArray(textures)) {
          const args = Array.prototype.slice.call(arguments);
          args[0] = textures.map(swap);
          return drawTextures.apply(this, args);
        }
        return drawTextures.apply(this, arguments);
      };
      wrapped.__jndRedDotWrapped = true;
      G.drawTextures = wrapped;
    }
    const loadImage = safe(() => G.loadImage, null);
    if (typeof loadImage === 'function' && !loadImage.__jndRedDotWrapped) {
      const wrapped = function (url) {
        if (typeof url === 'string' && isBadge(url)) return null;
        return loadImage.apply(this, arguments);
      };
      wrapped.__jndRedDotWrapped = true;
      G.loadImage = wrapped;
    }
    const spriteLoadImage = safe(() => Laya.Sprite && Laya.Sprite.prototype && Laya.Sprite.prototype.loadImage, null);
    if (typeof spriteLoadImage === 'function' && !spriteLoadImage.__jndRedDotWrapped) {
      const wrapped = function (url) {
        if (typeof url === 'string' && isBadge(url)) return null;
        return spriteLoadImage.apply(this, arguments);
      };
      wrapped.__jndRedDotWrapped = true;
      Laya.Sprite.prototype.loadImage = wrapped;
    }
    state.installed = true;
  }

  function tick() {
    const Laya = window.Laya;
    if (!Laya || !Laya.stage) return;
    if (!state.trans) {
      state.trans = transparent(Laya);
      if (!state.trans) return;
    }
    if (!state.installed) wrap(Laya);
    const now = Date.now();
    if (now - state.lastSweep >= 1000) {
      state.lastSweep = now;
      sweep(Laya);
    }
  }

  setInterval(tick, 200);
})();
