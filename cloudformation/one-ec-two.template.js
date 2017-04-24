'use strict';

const cf = require('@mapbox/cloudfriend');
const AmzAmis = require('./amis-amz.json');
const EcsAmis = require('./amis-ecs.json');

const Parameters = {
  KeyPair: { Type: 'String' },
  InstanceType: { Type: 'String', Default: 'c3.8xlarge' },
  AMI: { Type: 'String', Default: 'amz', Description: 'amz = latest amazon linux AMI, ecs = latest ecs-optimized AMI, or specify an ami ID' }
};

const Mappings = { AmzAmis, EcsAmis };

const Conditions = {
  UseLatestAmz: cf.equals(cf.ref('AMI'), 'amz'),
  UseLatestEcs: cf.equals(cf.ref('AMI'), 'ecs')
};

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
      ImageId: cf.if(
        'UseLatestAmz',
        cf.findInMap('AmzAmis', cf.region, 'ami'),
        cf.if(
          'UseLatestEcs',
          cf.findInMap('EcsAmis', cf.region, 'ami'),
          cf.ref('AMI')
        )
      ),
      InstanceType: cf.ref('InstanceType'),
      KeyName: cf.ref('KeyPair'),
      SecurityGroups: [cf.ref('SecurityGroup')],
      Tags: [
        { Key: 'Name', Value: cf.stackName },
        { Key: 'CostCategory', Value: 'RD' }
      ],
      UserData: cf.userData([
        'Content-Type: multipart/mixed; boundary="===============SLUB=="',
        'MIME-Version: 1.0',
        '--===============SLUB==',
        'MIME-Version: 1.0',
        'Content-Type: text/x-shellscript; charset="us-ascii"',
        'Content-Transfer-Encoding: 7bit',
        'Content-Disposition: attachment; filename="standard_userdata.txt"',
        '#!/bin/bash -e',
        'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
        'yum install -y lvm2',
        'drivecount=0',
        'ids=(b c d e f g h i j k)',
        'for z in "${ids[@]}"; do',
        '  drive="/dev/xvd${z}"',
        '  if [ -e ${drive} ]; then',
        '    umount ${drive} &> /dev/null || :',
        '    pvcreate -f -y ${drive}',
        '    [ "${drivecount}" == "0" ] && vgcreate vdata ${drive} || vgextend vdata ${drive}',
        '    drivecount=$((${drivecount} + 1))',
        '  fi',
        'done',
        'lvcreate --stripes ${drivecount} --stripesize 64 --wipesignatures y --name ldata --extents "100%VG" vdata',
        'mkfs.ext4 /dev/mapper/vdata-ldata',
        'tune2fs -m 0.05 /dev/mapper/vdata-ldata',
        'mkdir -p /mnt/data',
        'mount /dev/mapper/vdata-ldata /mnt/data',
        '--===============SLUB==',
        'MIME-Version: 1.0',
        'Content-Type: text/cloud-config; charset="us-ascii"',
        'Content-Transfer-Encoding: 7bit',
        'Content-Disposition: attachment; filename="cloud-config"',
        '#cloud-config',
        'repo_releasever: 2016.09',
        '--===============SLUB==--'
      ])
    }
  }
};

const Outputs = {
  PublicDns: { Value: cf.getAtt('Instance', 'PublicDnsName') }
};

module.exports = cf.merge({ Parameters, Conditions, Resources, Mappings, Outputs });
