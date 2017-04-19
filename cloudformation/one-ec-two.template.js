'use strict';

const cf = require('@mapbox/cloudfriend');
const AmzAmis = require('./amis-amz.json');

const Parameters = {
  KeyPair: { Type: 'String' },
  InstanceType: { Type: 'String', Default: 'c3.8xlarge' }
};

const Mappings = { AmzAmis };

const Resources = {
  InstanceRole: {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: ['ec2.amazonaws.com'] },
            Action: ['sts:AssumeRole']
          }
        ]
      },
      Policies: []
    }
  },
  InstanceProfile: {
    Type: 'AWS::IAM::InstanceProfile',
    Properties: {
      Path: '/',
      Roles: [cf.ref('InstanceRole')]
    }
  },
  SecurityGroup: {
    Type: 'AWS::EC2::SecurityGroup',
    Properties: {
      GroupDescription: 'SSH only',
      SecurityGroupIngress: [
        {
          IpProtocol: 'tcp',
          FromPort: '22',
          ToPort: '22',
          CidrIp: '0.0.0.0/0'
        }
      ]
    }
  },
  Instance: {
    Type: 'AWS::EC2::Instance',
    Properties: {
      AvailabilityZone: cf.select(0, cf.getAzs(cf.region)),
      IamInstanceProfile: cf.ref('InstanceProfile'),
      ImageId: cf.findInMap('AmzAmis', cf.region, 'ami'),
      InstanceType: cf.ref('InstanceType'),
      KeyName: cf.ref('KeyPair'),
      SecurityGroups: [cf.ref('SecurityGroup')],
      Tags: [
        { Key: 'Name', Value: cf.stackName },
        { Key: 'CostCategory', Value: 'RD' }
      ],
      UserData: cf.userData([
        '#!/bin/bash -e',
        'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
        'yum install -y lvm2',
        'drivecount=0',
        'ids=(b c d e f g h i j k)',
        'for z in "${ids[@]}"; do',
        '  drive="/dev/xvd${z}"',
        '  if [ -e ${drive} ]; then',
        '    umount ${drive} &> /dev/null || echo "unmount ${drive}"',
        '    pvcreate -f -y ${drive}',
        '    if [ "${drivecount}" == "0" ]; then',
        '      vgcreate data ${drive}',
        '    else',
        '      vgextend data ${drive}',
        '    fi',
        '    drivecount=$((${drivecount} + 1))',
        '  fi',
        'done',
        'lvcreate \\ ',
        '  --stripes ${drivecount} \\ ',
        '  --stripesize 64 \\ ',
        '  --wipesignatures y \\ ',
        '  --name ldata \\ ',
        '  --extents "100%VG" \\ ',
        '  vdata',
        'mkfs.ext4 /dev/mapper/vdata-ldata',
        'tune2fs -m 0.05 /dev/mapper/vdata-ldata',
        'mkdir -p /mnt/data',
        'mount /dev/mapper/vdata-ldata /mnt/data'
      ])
    }
  }
};

const Outputs = {
  PublicDns: { Value: cf.getAtt('Instance', 'PublicDnsName') }
};

module.exports = cf.merge({ Parameters, Resources, Mappings, Outputs });
