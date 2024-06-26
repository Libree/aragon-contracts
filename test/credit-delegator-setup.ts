import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { CreditDelegatorSetup } from '../typechain-types';
import { deployNewDAO } from "./utils/dao"
import metadata from '../contracts/plugins/credit-delegation/build-metadata.json';
import { Operation } from "./utils/types";
import {
  CreditDelegator__factory
} from '../typechain-types';

let defaultData: any;

const abiCoder = ethers.utils.defaultAbiCoder;
 
// Permissions
const WITHDRAWN_AAVE_PERMISSION_ID = ethers.utils.id(
  'WITHDRAWN_AAVE_PERMISSION'
);
const APPROVE_DELEGATION_PERMISSION_ID = ethers.utils.id('APPROVE_DELEGATION_PERMISSION');
const EXECUTE_PERMISSION_ID = ethers.utils.id('EXECUTE_PERMISSION');
const BORROW_AAVE_PERMISSION_ID = ethers.utils.id('BORROW_AAVE_PERMISSION');
const BORROW_AND_TRANSFER_AAVE_PERMISSION_ID = ethers.utils.id('BORROW_AND_TRANSFER_AAVE_PERMISSION');
const REGISTER_ACTIONS_PERMISSION_ID = ethers.utils.id('REGISTER_ACTIONS_PERMISSION');



describe('CreditDelegatorSetup', function () {
  let signers: SignerWithAddress[];
  let creditDelegatorSetup: CreditDelegatorSetup;
  let targetDao: any;
  const POOL_ADDRESS: string = '0x0b913a76beff3887d35073b8e5530755d60f78c7';
  const EMPTY_DATA = '0x';
  const AddressZero = ethers.constants.AddressZero;

  before(async () => {
    signers = await ethers.getSigners();
    targetDao = await deployNewDAO(signers[0].address);

    const CreditDelegatorSetup = await ethers.getContractFactory(
      'CreditDelegatorSetup'
    );

    creditDelegatorSetup = await CreditDelegatorSetup.deploy();

    defaultData = abiCoder.encode(metadata.pluginSetupABI.prepareInstallation, [
      POOL_ADDRESS
    ]);
  });


  describe('prepareInstallation', async () => {
    it('fails if data is empty, or not of minimum length', async () => {
      await expect(
        creditDelegatorSetup.prepareInstallation(targetDao.address, EMPTY_DATA)
      ).to.be.reverted;

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
        preparedSetupData: { helpers, permissions },
      } = await creditDelegatorSetup.callStatic.prepareInstallation(
        targetDao.address,
        defaultData
      );

      expect(plugin).to.be.equal(anticipatedPluginAddress);
      expect(helpers.length).to.be.equal(0);
      expect(permissions.length).to.be.equal(7);

      expect(permissions).to.deep.equal([
        [
          Operation.Grant,
          targetDao.address,
          plugin,
          AddressZero,
          EXECUTE_PERMISSION_ID,
        ],
        [
          Operation.Grant,
          plugin,
          targetDao.address,
          AddressZero,
          WITHDRAWN_AAVE_PERMISSION_ID,
        ],
        [
          Operation.Grant,
          plugin,
          targetDao.address,
          AddressZero,
          APPROVE_DELEGATION_PERMISSION_ID,
        ],
        [
          Operation.Grant,
          plugin,
          targetDao.address,
          AddressZero,
          BORROW_AAVE_PERMISSION_ID,
        ],
        [
          Operation.Grant,
          plugin,
          targetDao.address,
          AddressZero,
          BORROW_AND_TRANSFER_AAVE_PERMISSION_ID,
        ],
        [
          Operation.Grant,
          plugin,
          targetDao.address,
          AddressZero,
          REGISTER_ACTIONS_PERMISSION_ID,
        ],
        [
          Operation.Grant,
          plugin,
          plugin,
          AddressZero,
          BORROW_AND_TRANSFER_AAVE_PERMISSION_ID,
        ]
      ]);
    });

    it('correctly sets up the plugin', async () => {
      const daoAddress = targetDao.address;

      const nonce = await ethers.provider.getTransactionCount(
        creditDelegatorSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: creditDelegatorSetup.address,
        nonce,
      });

      await creditDelegatorSetup.prepareInstallation(daoAddress, defaultData);

      const factory = new CreditDelegator__factory(signers[0]);
      const creditDelegatorAddressContract = factory.attach(anticipatedPluginAddress);

      expect(await creditDelegatorAddressContract.dao()).to.be.equal(daoAddress);
    });
  });

});