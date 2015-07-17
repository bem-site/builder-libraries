var bsBuilderCore = require('bs-builder-core'),
    bsBuilderLibraries = require('../index'),

    dataPath = './data',
    cachePath = './.builder/cache',
    builder;

builder = bsBuilderCore.Builder.init('debug')
    .setLanguages(['en', 'ru'])
    .setModelFilePath('./model/model.json')
    .setDataFolder(dataPath)
    .setCacheFolder(cachePath)
    .addTask(bsBuilderCore.tasks.MakeDirectory, { path: cachePath })
    .addTask(bsBuilderCore.tasks.MakeDirectory, { path: dataPath })
    .addTask(bsBuilderCore.tasks.LoadModelFiles)
    .addTask(bsBuilderCore.tasks.MergeModels)
    .addTask(bsBuilderCore.tasks.SaveModelFile)
    .addTask(bsBuilderCore.tasks.AnalyzeModel)
    .addTask(bsBuilderCore.tasks.MakePagesCache)
    .addTask(bsBuilderLibraries.tasks.LibrariesSyncMDS, {
        mds: {
            namespace: 'beta-lego-site',
            host: 'storage.mds.yandex.net',
            port: 80
        }
    })
    .addTask(bsBuilderLibraries.tasks.LibrariesDataGen)
    .addTask(bsBuilderCore.tasks.RsyncPages, {
        exclude: ['*.md', '*.meta.json']
    })
    .addTask(bsBuilderCore.tasks.SaveDataFile);

builder.run();
