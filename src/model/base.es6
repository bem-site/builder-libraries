import vow from 'vow';
import fsExtra from 'fs-extra';
import Logger from 'bem-site-logger';

export default class Base {
    constructor() {
        this.logger = Logger.createLogger(module);
        this._data = {};
    }

    setValue(field, value, lang) {
        if(lang) {
            this._data[lang] = this._data[lang] || {};
            this._data[lang][field] = value;
        }
        this._data[field] = value;
        return this;
    }

    saveFile(filePath, content, isJSON) {
        var method = isJSON ? 'outputJSON' : 'outputFile';
        return new vow.Promise((resolve, reject) => {
            fsExtra[method](filePath, content, 'utf-8', (error) => {
                if (error) {
                    this.logger
                        .error(`Error occur while saving file: ${filePath}`)
                        .error(`Error: ${error.message}`);
                    reject(error);
                }
                resolve(filePath);
            });
        });
    }

    getData() {
        return this._data;
    }
}
