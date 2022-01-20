const aws       = require('aws-sdk');

const {config}  = require('./config.js')

aws.config.update({accessKeyId: config.awsKey, secretAccessKey: config.awsSecret});
aws.config.region = config.awsRegion;

var payload = {
    'inbucket':     'testbucket',
    'inkey':        'pdfpng/pngout/',
    'outbucket':    'testbucket', 
    'outkey':       'pdfpng/output.pdf'
};

var lambda = new aws.Lambda();
var request = 
{
    Payload: JSON.stringify(payload),
    FunctionName: 'png2pdf',
    InvocationType: 'RequestResponse',
};

lambda.invoke(request, function(err, response) 
{
    console.log('lambda: ', err, response)
});