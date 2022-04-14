const chokidar = require('chokidar');
const path = require('path');

const log = (...args) =>
  (global.Omegga ?? global.Logger).log(
    'reloader'.underline,
    '>>'.green,
    ...args
  );
const error = (...args) =>
  (global.Omegga ?? global.Logger).error(
    'reloader'.underline,
    '!>'.red,
    ...args
  );

module.exports = class Reloader {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() {
    const pattern = this.config['watch-all-js'] ? '**/*.js' : '*/omegga.*.*';
    this.watcher = chokidar.watch(
      path.join(this.omegga.pluginLoader.path, pattern)
    );
    let wasLoaded = {};

    this.watcher
      .on('change', async file => {
        // find the plugin that has this file
        const plugin = this.omegga.pluginLoader.plugins.find(p =>
          file.startsWith(p.path)
        );

        // somehow you snuck in an incomplete plugin
        if (!plugin) return;

        if (plugin.loadedPlugin === this)
          log('I used the reloader to reload the reloader'.rainbow);

        const name = plugin.getName();
        // announce we found a change
        log(
          name.yellow,
          `- Detected change in ${path.basename(file)}`,
          !plugin.isLoaded() && !wasLoaded[name]
            ? 'but plugin is not loaded.'
            : ''
        );

        let ok;
        if (plugin.isLoaded()) {
          wasLoaded[name] = true;
          log(name.yellow, '- Unloading plugin');
          ok = await plugin.unload();
          if (!ok) return error(name.brightRed, '- Error unloading plugin');
        }
        if (!plugin.isLoaded() && wasLoaded[name]) {
          ok = await plugin.load();
          if (!ok) return error(name.brightRed, '- Error loading plugin');
          log(name.yellow, '- Reloaded plugin');
        }
      })
      .on('error', error => error(`Watcher error: ${error}`))
      .on('ready', () =>
        log(
          'Watching plugins at',
          path.join(this.omegga.pluginLoader.path, pattern)
        )
      );
  }

  async stop() {
    log('Closing watcher...');
    await this.watcher.close();
  }
};
