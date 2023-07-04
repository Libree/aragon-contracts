import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { SubgovernanceSetup } from '../typechain-types';
import { deployNewDAO } from "./utils/dao"
import metadata from '../contracts/plugins/subgovernance-plugin/build-metadata.json';
import {
  Subgovernance__factory
} from '../typechain-types';

let defaultData: any;
const abiCoder = ethers.utils.defaultAbiCoder;

describe('SubgovernanceSetup', function () {
  let signers: SignerWithAddress[];
  let subgovernanceSetup: SubgovernanceSetup;
  let targetDao: any;

  before(async () => {
    signers = await ethers.getSigners();
    targetDao = await deployNewDAO(signers[0].address);

    const SubgovernanceSetup = await ethers.getContractFactory(
      'SubgovernanceSetup'
    );

    subgovernanceSetup = await SubgovernanceSetup.deploy();

    defaultData = abiCoder.encode(metadata.pluginSetupABI.prepareInstallation, []);
  });


  describe('prepareInstallation', async () => {
    it('fails if data is empty, or not of minimum length', async () => {
      await expect(
        subgovernanceSetup.prepareInstallation(
          targetDao.address,
          defaultData
        )
      ).not.to.be.reverted;
    });

    it('correctly returns plugin, helpers and permissions', async () => {
      const nonce = await ethers.provider.getTransactionCount(
        subgovernanceSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: subgovernanceSetup.address,
        nonce,
      });

      const {
        plugin,
        preparedSetupData: { helpers, permissions },
      } = await subgovernanceSetup.callStatic.prepareInstallation(
        targetDao.address,
        defaultData
      );

      expect(plugin).to.be.equal(anticipatedPluginAddress);
      expect(helpers.length).to.be.equal(0);
      expect(permissions.length).to.be.equal(0);
    });

    it('correctly sets up the plugin', async () => {
      const daoAddress = targetDao.address;

      const nonce = await ethers.provider.getTransactionCount(
        subgovernanceSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: subgovernanceSetup.address,
        nonce,
      });

      await subgovernanceSetup.prepareInstallation(daoAddress, defaultData);

      const factory = new Subgovernance__factory(signers[0]);
      const vaultAddressContract = factory.attach(anticipatedPluginAddress);

      expect(await vaultAddressContract.dao()).to.be.equal(daoAddress);
    });
  });

});