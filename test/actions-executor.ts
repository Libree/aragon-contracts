import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployNewDAO } from "./utils/dao"
import { getMergedABI } from './utils/abi';
import { deployWithProxy } from './utils/proxy';
import { shouldUpgradeCorrectly } from './utils/uups-upgradeable';
import { UPGRADE_PERMISSIONS } from './utils/permissions';
import { OZ_ERRORS } from './utils/error';
import {
    ActionsExecutor__factory,
    ERC20__factory
} from '../typechain-types';

import {
    DaoAction,
} from "@aragon/sdk-client-common";

import {
    hexToBytes
} from "@aragon/sdk-common";


describe('ActionsExecutor plugin', function () {
    let signers: SignerWithAddress[];
    let dao: any;
    let ownerAddress: string;
    let pluginFactoryBytecode: any;
    let plugin: any;
    let mergedAbi: any;
    let owner: SignerWithAddress
    let nonAuthUser: SignerWithAddress
    const REGISTER_ACTIONS_PERMISSION_ID = ethers.utils.id('REGISTER_ACTIONS_PERMISSION');
    const EXECUTE_PERMISSION_ID = ethers.utils.id('EXECUTE_PERMISSION');
    const WETH_ADDRESS: string = '0xD087ff96281dcf722AEa82aCA57E8545EA9e6C96';


    before(async () => {
        signers = await ethers.getSigners();
        ownerAddress = await signers[0].getAddress();
        owner = signers[0];
        nonAuthUser = signers[2];

        ({ abi: mergedAbi, bytecode: pluginFactoryBytecode } = await getMergedABI(
            // @ts-ignore
            hre,
            'ActionsExecutor',
            ['DAO']
        ));

        dao = await deployNewDAO(ownerAddress);

    });

    beforeEach(async function () {
        const PluginFactory = new ethers.ContractFactory(
            mergedAbi,
            pluginFactoryBytecode,
            signers[0]
        );

        plugin = await deployWithProxy(PluginFactory);

        await dao.grant(
            plugin.address,
            ownerAddress,
            REGISTER_ACTIONS_PERMISSION_ID
        );

        await dao.grant(
            plugin.address,
            dao.address,
            REGISTER_ACTIONS_PERMISSION_ID
        );

        await dao.grant(
            dao.address,
            plugin.address,
            EXECUTE_PERMISSION_ID
        );

        this.upgrade = {
            contract: plugin,
            dao: dao,
            user: signers[8],
        };

    });

    function initializePlugin() {
        return plugin.initialize(dao.address);
    }

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: plugin,
                dao: dao,
                user: signers[8],
            };
            await plugin.initialize(dao.address);
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await plugin.initialize(dao.address);

            await expect(
                plugin.initialize(dao.address)
            ).to.be.revertedWith(OZ_ERRORS.ALREADY_INITIALIZED);
        });
    });


    describe('Registering actions assets: ', async () => {
        beforeEach(async () => {
            await initializePlugin();
        });

        it('Register an action', async () => {
            const ifaceERC20 = ERC20__factory.createInterface()
            const approveAction = ifaceERC20.encodeFunctionData(
                'transfer',
                [
                    ownerAddress,
                    10
                ]
            )

            const action: DaoAction = {
                to: dao.address,
                value: ethers.utils.parseEther('0').toBigInt(),
                data: hexToBytes(approveAction)
            }

            await plugin.registerActions(dao.address, [action], 0)
            const pendingActionsCount = await plugin._currentPending()
            expect(pendingActionsCount).to.be.equal(1)

        });


        it('Registers an action and execute', async () => {
            const depositAmount = ethers.utils.parseUnits("10", "ether")
            const withdrawnAmount = ethers.utils.parseUnits("10", "ether")
            const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
            await weth.transfer(dao.address, depositAmount)

            const balanceBefore = await weth.balanceOf(dao.address)

            expect(balanceBefore).to.be.equals(depositAmount)

            const ifaceERC20 = ERC20__factory.createInterface()
            const transferAction = ifaceERC20.encodeFunctionData(
                'transfer',
                [
                    ownerAddress,
                    withdrawnAmount
                ]
            )

            const action: DaoAction = {
                to: WETH_ADDRESS,
                value: ethers.utils.parseEther('0').toBigInt(),
                data: hexToBytes(transferAction)
            }

            await plugin.registerActions(dao.address, [action], 0)
            const pendingActionsCount = await plugin._currentPending()
            expect(pendingActionsCount).to.be.equal(1)

            await plugin.executeActions(0)

            const balanceAfter = await weth.balanceOf(dao.address)

            expect(balanceAfter).to.be.equals(depositAmount.sub(withdrawnAmount))

        });


        it('Registers an action to register an action and execute', async () => {
            const depositAmount = ethers.utils.parseUnits("10", "ether")
            const withdrawnAmount = ethers.utils.parseUnits("10", "ether")
            const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
            await weth.transfer(dao.address, depositAmount)

            const balanceBefore = await weth.balanceOf(dao.address)

            expect(balanceBefore).to.be.equals(depositAmount)

            const ifaceERC20 = ERC20__factory.createInterface()
            const transferAction = ifaceERC20.encodeFunctionData(
                'transfer',
                [
                    ownerAddress,
                    withdrawnAmount
                ]
            )

            const actionWithdrawn: DaoAction = {
                to: WETH_ADDRESS,
                value: ethers.utils.parseEther('0').toBigInt(),
                data: hexToBytes(transferAction)
            }

            const ifaceExecutor = ActionsExecutor__factory.createInterface()
            const register = ifaceExecutor.encodeFunctionData(
                'registerActions',
                [
                    dao.address,
                    [actionWithdrawn],
                    0
                ]
            )

            const actionRegister: DaoAction = {
                to: plugin.address,
                value: ethers.utils.parseEther('0').toBigInt(),
                data: hexToBytes(register)
            }

            await plugin.registerActions(dao.address, [actionRegister], 0)
            const pendingActionsCount = await plugin._currentPending()
            expect(pendingActionsCount).to.be.equal(1)

            await plugin.executeActions(0)

            const pendingActionsCountRegistered = await plugin._currentPending()
            expect(pendingActionsCountRegistered).to.be.equal(2)

            await plugin.executeActions(1)

            const balanceAfter = await weth.balanceOf(dao.address)

            expect(balanceAfter).to.be.equals(depositAmount.sub(withdrawnAmount))
        });
    })
});