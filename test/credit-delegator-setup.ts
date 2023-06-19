import {expect} from 'chai';
import {ethers} from 'hardhat';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';

import {CreditDelegatorSetup} from '../typechain-types';
import { deployNewDAO } from "./utils/dao"
import metadata from '../contracts/credit-delegation-plugin/build-metadata.json';

let defaultData: any;

const abiCoder = ethers.utils.defaultAbiCoder;

describe('CreditDelegatorSetup', function () {
  let signers: SignerWithAddress[];
  let creditDelegatorSetup: CreditDelegatorSetup;
  let implementationAddress: string;
  let targetDao: any;

  before(async () => {
    signers = await ethers.getSigners();
    targetDao = await deployNewDAO(signers[0].address);

    const CreditDelegatorSetup = await ethers.getContractFactory(
      'CreditDelegatorSetup'
    );

    creditDelegatorSetup = await CreditDelegatorSetup.deploy();

    implementationAddress = await creditDelegatorSetup.implementation();

    defaultData = abiCoder.encode(metadata.pluginSetupABI.prepareInstallation, [
        signers[1].address
      ]);
  });


  describe('prepareInstallation', async () => {
    it('fails if data is empty, or not of minimum length', async () => {
      await expect(
        creditDelegatorSetup.prepareInstallation(
          targetDao.address,
          defaultData
        )
      ).not.to.be.reverted;
    });

    it('correctly returns plugin, helpers and permissions', async () => {
      const nonce = await ethers.provider.getTransactionCount(
        creditDelegatorSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: creditDelegatorSetup.address,
        nonce,
      });

      const {
        plugin,
        preparedSetupData: {helpers, permissions},
      } = await creditDelegatorSetup.callStatic.prepareInstallation(
        targetDao.address,
        defaultData
      );

      expect(plugin).to.be.equal(anticipatedPluginAddress);
      expect(helpers.length).to.be.equal(0);
      expect(permissions.length).to.be.equal(1);
    });
  });
});