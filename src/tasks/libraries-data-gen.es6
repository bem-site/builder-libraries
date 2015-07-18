/**
 * Module for libraries files generation
 * @module src/tasks/libraries-data-gen.es6
 * @author Kuznetsov Andrey
 */

import os from 'os';
import workerFarm from 'worker-farm';
import LibrariesBase from './libraries-base';

/**
 * @exports
 * @class LibrariesDataGen
 * @classdesc Sync libraries MDS libraries data with local system
 */
export default class LibrariesSyncMDS extends LibrariesBase {

    constructor (baseConfig, taskConfig) {
        super(baseConfig, taskConfig);

        this.getTaskConfig().baseUrl = this.getTaskConfig().baseUrl || '/libs';
        this.workers = workerFarm(require.resolve('../worker'));
    }

    /**
     * Returns module instance for log purposes
     * @static
     * @returns {Module}
     */
    static getLoggerName () {
        return module;
    }

    /**
     * Return task human readable description
     * @static
     * @returns {String} path
     */
    static getName () {
        return 'generate libraries files';
    }

    _findLibraryChanges(model, type) {
        return model.getChanges().pages[type].filter(item => {
            return item.lib && item.version;
        });
    }

    _spreadByProcesses(libVersions, numOfProcesses) {
        var result = [],
            processNum = 0;

        for(let i = 0; i < numOfProcesses; i++) {
            result[i] = [];
        }

        return libVersions.reduce((prev, item) => {
            prev[processNum++].push(item);
            processNum === numOfProcesses && (processNum = 0);
            return prev;
        }, result);
    }

    /**
     * Performs task
     * @public
     * @returns {Promise}
     */
    run (model) {
        this.beforeRun();

        var numberOfProcesses = os.cpus().length,
            processesQueues = this._spreadByProcesses([]
                .concat(this._findLibraryChanges(model, 'added'))
                .concat(this._findLibraryChanges(model, 'modified')), numberOfProcesses),
            count = 0;

        return new Promise(resolve => {
            for(let i = 0; i < numberOfProcesses; i++) {
                this.workers({
                    baseUrl: this.getTaskConfig().baseUrl,
                    basePath: this.getLibrariesCachePath(),
                    data: processesQueues[i],
                    languages: this.getBaseConfig().getLanguages()
                }, (err, output) => {
                    err;
                    output;
                    if (++count === numberOfProcesses) {
                        workerFarm.end(this.workers);
                        resolve(model);
                    }
                });
            }
        });
    }
}
