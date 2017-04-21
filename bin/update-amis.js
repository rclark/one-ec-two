#!/usr/bin/env node

'use strict';

const Table = require('easy-table');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'ap-southeast-2'
];

module.exports = () => {
  return Promise.all(regions.map(latestEcsAmi))
    .then((latest) => {
      const t = new Table();

      latest.forEach((image) => {
        t.cell('Region', image.region);
        t.cell('AMI', image.id);
        t.cell('Name', image.name);
        t.newRow();
      });

      process.stdout.write(`\nNew ECS AMIS:\n\n${t.toString()}\n`);

      return updateMapping(latest, 'amis-ecs.json');
    })
    .then(() => Promise.all(regions.map(latestAmzAmi)))
    .then((latest) => {
      const t = new Table();

      latest.forEach((image) => {
        t.cell('Region', image.region);
        t.cell('AMI', image.id);
        t.cell('Name', image.name);
        t.newRow();
      });

      process.stdout.write(`\nNew AMZ AMIS:\n\n${t.toString()}\n`);

      return updateMapping(latest, 'amis-amz.json');
    });
};

function latestAmzAmi(region) {
  const ec2 = new AWS.EC2({ region });
  const params = {
    Filters: [
      { Name: 'name', Values: ['amzn-ami-hvm-*.*.*.*-x86_64-s3'] },
      { Name: 'owner-alias', Values: ['amazon'] }
    ]
  };

  return ec2.describeImages(params).promise()
    .then((data) => {
      const images = data.Images.reduce((images, image) => {
        if (/\.rc-\d\./.test(image.Name)) return images; // ignore release candidates

        images.push({
          id: image.ImageId,
          created: +new Date(image.CreationDate),
          name: image.Name,
          region: region
        });

        return images;
      }, []).sort((a, b) => a.created - b.created);
      return images.pop();
    });
}

function latestEcsAmi(region) {
  const ec2 = new AWS.EC2({ region });
  const params = {
    Filters: [
      { Name: 'name', Values: ['*ecs-optimized'] },
      { Name: 'owner-alias', Values: ['amazon'] }
    ]
  };

  return ec2.describeImages(params).promise()
    .then((data) => {
      const images = data.Images.map((image) => {
        return {
          id: image.ImageId,
          created: +new Date(image.CreationDate),
          name: image.Name,
          region: region
        };
      }).sort((a, b) => a.created - b.created);

      return images.pop();
    });
}

function updateMapping(latest, name) {
  const mapping = path.resolve(__dirname, '..', 'cloudformation', name);
  const details = require(mapping);
  latest.forEach((image) => {
    if (!details[image.region]) return;
    details[image.region].ami = image.id;
  });

  fs.writeFileSync(mapping, JSON.stringify(details, null, 2));
}

if (require.main === module) module.exports()
  .catch((err) => process.stderr.write(`${err.stack}\n`));
