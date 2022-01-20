const fs        = require("fs")
const aws       = require('aws-sdk');
const async     = require('async');
const pdfkit    = require('pdfkit');

const {config}  = require('./config.js')

exports.handler = (event, context, callback) => {

    console.log('handler:', event)

    bucketList(event.inbucket, event.inkey, function(err, list)
    {
        if(err)
        {
            callback(new Error(err))
        }
        else
        {
            try
            {
                if(list.Contents && list.Contents.length > 0)
                {
                    var files = [];
                    for(var index in list.Contents)
                    {
                        var item = list.Contents[index];

                        var name = item.Key.slice(-3).toLowerCase();
                        if(name != 'png')
                            continue
                        
                        files.push(item.Key);
                    }

                    if(files.length > 0)
                    {
                        files.sort();

                        console.log('png2pdf files:', files);
                                            
                        var pdf = new pdfkit({ autoFirstPage: false });
                        
                        var filepath = '/tmp/out.pdf';
                        if(fs.existsSync(filepath)) fs.unlinkSync(filepath);

                        filestream = fs.createWriteStream(filepath);
                        pdf.pipe(filestream); 

                        async.eachSeries(files, function(file, callbackSeries)
                        {
                            console.log('png2pdf processing:', file)

                            downloadBuffer(event.inbucket, file, function(err, data)
                            {
                                if(err)
                                {
                                    callbackSeries(new Error(err));
                                }
                                else
                                {
                                    var img = pdf.openImage(data.Body);
                                    if(img)
                                    {
                                        pdf.addPage({size: [img.width, img.height]});
                                        pdf.image(img, 0, 0);

                                        callbackSeries(null);       
                                    }
                                    else
                                    {
                                        console.log('png2pdf image open failed:');

                                        callbackSeries(new Error(e));    
                                    }
                                }
                            });
                        },
                        function(err)
                        {
                            console.log('png2pdf done:', err);
                            
                            if(err)
                            {
                                callback(new Error(e));
                            }     
                            else
                            {
                                filestream.addListener('finish', function() 
                                {
                                    console.log('png2pdf end');
                                            
                                    var stream = fs.createReadStream(filepath);
                                    uploadBuffer(stream, event.outbucket, event.outkey, function(err, data)
                                    {
                                        fs.unlinkSync(filepath)

                                        if(err)
                                        {
                                            callback(new Error(err));
                                        }
                                        else
                                        {
                                            console.log('png2pdf results:', data);
                                            
                                            callback(null, data);           
                                        }
                                    })                        
                                });   

                                console.log('png2pdf info:', pdf.page.width, pdf.page.height);

                                pdf.end();         
                            }                       
                        });
                        return;
                    }
                }

                callback(new Error('No files found!'))                
            }
            catch(e) 
            {
                console.log('png2pdf exception:', e);

                callback(new Error(JSON.stringify(e)));
            }
        }
    })
}

function fileSize(p)
{
    if(fs.existsSync(p)) 
    { 
        return fs.lstatSync(p).size; 
    } 
    return false; 
}

function downloadBuffer(bucket, key, callback)
{
    aws.config.update({accessKeyId: config.awsKey, secretAccessKey: config.awsSecret});
    aws.config.region = config.awsRegion;
    
    var s3 = new aws.S3(); 
    
    const params = {
        Bucket: bucket,
        Key: key, 
    };
    
    console.log("downloadBuffer: ", bucket, key);

    s3.getObject(params, function(err, data)
    {
        if (err) 
        {
            console.log("downloadBuffer err: ", err);
            
            if(callback) callback(err);   
        }
        else
        {
            console.log("downloadBuffer ok: ", data.ETag);

            if(callback) callback(false, data);   
        }
    })
}

function uploadBuffer(data, bucket, key, callback)
{        
    aws.config.update({accessKeyId: config.awsKey, secretAccessKey: config.awsSecret});
    aws.config.region = config.awsRegion;
    
    var s3 = new aws.S3(); 
    
    const params = {
        ACL: 'public-read',
        ContentType: 'application/octet-stream',
        Bucket: bucket,
        Key: key, 
        Body: data 
    };
    
    console.log("uploadBuffer: ", bucket, key);

    s3.putObject(params, function(err, data) 
    {   
        if (err) 
        {   
            console.log("uploadBuffer err: ", err);

            if(callback) callback(err);   
        } 
        else 
        {   
            console.log("uploadBuffer ok: ", data);

            if(callback) callback(false, data);
        }   
    });                 
}

function bucketList(bucket, key, callback)
{
    aws.config.update({accessKeyId: config.awsKey, secretAccessKey: config.awsSecret});
    aws.config.region = config.awsRegion;
    
    var s3 = new aws.S3(); 

    const params = {
        Bucket: bucket,
        MaxKeys: 1000,
        Prefix: key,
        Delimiter: '/'
    };

    console.log("bucketList: ", bucket, key);

    s3.listObjectsV2 (params, function(err, data)
    {
        if (err) 
        {
            console.log("bucketList err: ", err);
            
            if(callback) callback(err);               
        }
        else
        {
            console.log("bucketList ok: ", data.Contents.length);            
        
            if(callback) callback(false, data);
        }
    });
}