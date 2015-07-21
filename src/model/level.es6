import vow from 'vow';
import Base from './base';
import Block from './block';

/**
 * @exports
 * @class Level
 * @desc level library model class
 */
export default class Level extends Base {
    /**
     * Level constructor
     * @param {Object} version data object
     * @param {String[]}  version.languages - array of languages
     * @param {String} version.baseUrl - base libraries url
     * @param {String} version.basePath - base path for libraries file inside cache folder
     * @param {String} version.lib - name of library
     * @param {String} version.version - name of library version
     * @param {String} level - name of block level
     * @constructor
     */
    constructor (version, level) {
        super();

        /**
         * Library version data object
         * @type {{languages: String[], baseUrl: String, basePath: String, lib: String, version: String}}
         */
        this.version = version;

        /**
         * Name of blocks level
         * @type {String}
         */
        this.level = level.replace('.docs', '').replace('.sets', '');
    }

    /**
     * Processes blocks level data
     * @param {Object} data - level data object
     * @returns {Promise}
     */
    processData(data) {
        var version = this.version;

        this.setValue('url', [version.baseUrl, version.lib, version.version, this.level].join('/'))
            .setValue('aliases', []) // алиасы или редиректы
            .setValue('view', 'level') // представление
            .setValue('lib', version.lib) // название библиотеки
            .setValue('version', version.version) // название версии библиотеки
            .setValue('level', this.level); // имя уровня переопредления

        version.languages.forEach(lang => {
            this.setValue('title', this.level, lang) // имя уровня переопределения
                .setValue('published', true, lang) // флаг о том что страница опубликована
                .setValue('updateDate', +(new Date()), lang); // дата обновления
        });

        // нужно создать данные для всех блоков данного уровня переопределения
        // сохранить файлы с документацией и jsdoc для каждого блока
        // и вернуть данные страниц блоков. После чего эти данные склеиваются друг с другом
        // и данными самого уровня переопределения в единый массив
        return vow
            .all(data.blocks.map(block => {
                return (new Block(this, block.name)).processData(block);
            }))
            .then(blocks => {
                return blocks.reduce((prev, item) => {
                    return prev.concat(item);
                }, [this.getData()]);
            });
    }
}
