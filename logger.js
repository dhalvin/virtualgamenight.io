const {createLogger, transports, format} = require('winston');
const logger = createLogger({
    level: (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transports: [
        new transports.File({ 
            filename: 'log/error.log', 
            level: 'error',
            format: format.combine(format.timestamp(), format.errors({ stack: true }), format.prettyPrint())}),
        new transports.File({ 
            filename: 'log/combined.log', 
            level: 'info',
            format: format.combine(format.timestamp(), format.prettyPrint())})
    ],
    exceptionHandlers: [
        new transports.File({
            filename: 'log/exceptions.log',
            format: format.combine(format.timestamp(), format.errors({ stack: true }), format.prettyPrint())
        })
    ]
});

if(process.env.NODE_ENV !== 'production'){
    logger.add(new transports.Console({
        level: 'debug',
        format: format.combine(format.errors({stack: true}), format.colorize(), format.prettyPrint())
    }));
}

module.exports = logger;