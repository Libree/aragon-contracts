import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployNewDAO } from "./utils/dao"
import { getMergedABI } from './utils/abi';
import { deployWithProxy } from './utils/proxy';
import { shouldUpgradeCorrectly } from './utils/uups-upgradeable';
import { UPGRADE_PERMISSIONS } from './utils/permissions';
import { OZ_ERRORS } from './utils/error';
import { CreditDelegator__factory } from "../typechain-types";
import {
    hexToBytes
} from "@aragon/sdk-common";
import {
    DaoAction,
} from "@aragon/sdk-client-common";

describe('Credit delegator plugin', function () {
    let signers: SignerWithAddress[];
    let daoLender: any;
    let ownerAddress: string;
    let borrowerAddress: string;
    let borrower: any;
    let creditDelegatorFactoryBytecode: any;
    let mergedAbi: any;
    let creditDelegatorLender: any;
    const POOL_ADDRESS: string = '0x0b913a76beff3887d35073b8e5530755d60f78c7';
    const WETH_ADDRESS: string = '0xD087ff96281dcf722AEa82aCA57E8545EA9e6C96';
    const USDC_DEBT_ADDRESS: string = '0xe336cbd5416cdb6ce70ba16d9952a963a81a918d';
    const USDC = '0xe9DcE89B076BA6107Bb64EF30678efec11939234'
    const APPROVE_DELEGATION_PERMISSION_ID = ethers.utils.id('APPROVE_DELEGATION_PERMISSION');
    const EXECUTE_PERMISSION_ID = ethers.utils.id('EXECUTE_PERMISSION');
    const WITHDRAWN_AAVE_PERMISSION_ID = ethers.utils.id(
        'WITHDRAWN_AAVE_PERMISSION'
    );
    const BORROW_AAVE_PERMISSION_ID = ethers.utils.id(
        'BORROW_AAVE_PERMISSION'
    );

    const BORROW_AND_TRANSFER_AAVE_PERMISSION_ID = ethers.utils.id(
        'BORROW_AND_TRANSFER_AAVE_PERMISSION'
    );

    const REGISTER_ACTIONS_PERMISSION_ID = ethers.utils.id(
        'REGISTER_ACTIONS_PERMISSION'
    );

    before(async () => {
        signers = await ethers.getSigners();
        ownerAddress = await signers[0].getAddress();
        borrowerAddress = await signers[2].getAddress();
        borrower = signers[2];

        ({ abi: mergedAbi, bytecode: creditDelegatorFactoryBytecode } = await getMergedABI(
            // @ts-ignore
            hre,
            'CreditDelegator',
            ['DAO']
        ));

        daoLender = await deployNewDAO(ownerAddress);
    });

    beforeEach(async function () {
        const CreditDelegatorFactory = new ethers.ContractFactory(
            mergedAbi,
            creditDelegatorFactoryBytecode,
            signers[0]
        );

        creditDelegatorLender = await deployWithProxy(CreditDelegatorFactory);

        await daoLender.grant(
            daoLender.address,
            creditDelegatorLender.address,
            EXECUTE_PERMISSION_ID
        );

        await daoLender.grant(
            creditDelegatorLender.address,
            ownerAddress,
            WITHDRAWN_AAVE_PERMISSION_ID
        );

        await daoLender.grant(
            creditDelegatorLender.address,
            ownerAddress,
            APPROVE_DELEGATION_PERMISSION_ID
        );

        await daoLender.grant(
            creditDelegatorLender.address,
            ownerAddress,
            BORROW_AAVE_PERMISSION_ID
        );

        await daoLender.grant(
            creditDelegatorLender.address,
            ownerAddress,
            BORROW_AND_TRANSFER_AAVE_PERMISSION_ID
        );

        await daoLender.grant(
            creditDelegatorLender.address,
            creditDelegatorLender.address,
            BORROW_AND_TRANSFER_AAVE_PERMISSION_ID
        );

        await daoLender.grant(
            creditDelegatorLender.address,
            ownerAddress,
            REGISTER_ACTIONS_PERMISSION_ID
        );

        this.upgrade = {
            contract: creditDelegatorLender,
            dao: daoLender,
            user: signers[8],
        };

    });

    function initializePlugin() {
        return creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS);
    }

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: creditDelegatorLender,
                dao: daoLender,
                user: signers[8],
            };
            await creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS);
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS);

            await expect(
                creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS)
            ).to.be.revertedWith(OZ_ERRORS.ALREADY_INITIALIZED);
        });
    });


    describe('Delegate credit: ', async () => {
        beforeEach(async () => {
            await initializePlugin();
        });

        // it('Deposit 10 WETH in DAO treasury', async () => {
        //     const depositAmount = ethers.utils.parseUnits("10", "ether")
        //     const aavePool = await ethers.getContractAt('IPool', POOL_ADDRESS)

        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)

        //     const daoAccountDataBefore = await aavePool.getUserAccountData(daoLender.address)

        //     await weth.approve(creditDelegatorLender.address, depositAmount)
        //     await weth.approve(POOL_ADDRESS, depositAmount)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     const daoAccountDataAfter = await aavePool.getUserAccountData(daoLender.address)

        //     expect(daoAccountDataBefore.totalCollateralBase.toNumber()).to.be.equals(0)
        //     expect(daoAccountDataAfter.totalCollateralBase.toNumber()).to.be.greaterThan(0)
        // });


        // it('Should approve delegation', async () => {
        //     const depositAmount = ethers.utils.parseUnits("10", "ether")
        //     const amount = 1000
        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
        //     await weth.approve(creditDelegatorLender.address, depositAmount)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     await creditDelegatorLender.approveDelegation(
        //         USDC_DEBT_ADDRESS,
        //         borrowerAddress,
        //         amount
        //     )

        //     const debtToken = await ethers.getContractAt('ICreditDelegationToken', USDC_DEBT_ADDRESS)
        //     const approvedAmount = await debtToken.borrowAllowance(daoLender.address, borrowerAddress)

        //     expect(approvedAmount.toNumber()).to.be.equals(approvedAmount)
        // });

        // it('Should revert approve delegation not authorized', async () => {
        //     const amount = 1000
        //     await expect(creditDelegatorLender.connect(signers[1]).approveDelegation(
        //         USDC_DEBT_ADDRESS,
        //         borrowerAddress,
        //         amount
        //     )).to.be.revertedWithCustomError(creditDelegatorLender, 'DaoUnauthorized')
        //         .withArgs(
        //             daoLender.address,
        //             creditDelegatorLender.address,
        //             signers[1].address,
        //             APPROVE_DELEGATION_PERMISSION_ID
        //         );
        // });


        // it('Should borrow on behalf of Lender', async () => {
        //     const depositAmount = ethers.utils.parseUnits("10", "ether")
        //     const amount = 1000
        //     const interestRateMode = 1

        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
        //     const usdc = await ethers.getContractAt('IERC20', USDC)

        //     await weth.approve(creditDelegatorLender.address, depositAmount)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     await creditDelegatorLender.approveDelegation(
        //         USDC_DEBT_ADDRESS,
        //         borrowerAddress,
        //         amount
        //     )

        //     const aavePool = await ethers.getContractAt('IPool', POOL_ADDRESS)
        //     const balanceBefore = await usdc.balanceOf(borrowerAddress)

        //     await aavePool.connect(borrower).borrow(
        //         USDC,
        //         amount,
        //         interestRateMode,
        //         0,
        //         daoLender.address
        //     )

        //     const balanceAfter = await usdc.balanceOf(borrowerAddress)

        //     expect(balanceBefore.toNumber()).to.be.equals(0)
        //     expect(balanceAfter.toNumber()).to.be.equals(amount)

        // });


        // it('Should borrow using DAO collateral treasury', async () => {
        //     const depositAmount = ethers.utils.parseUnits("1", "ether")
        //     const amount = 1000
        //     const interestRateMode = 1

        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
        //     const usdc = await ethers.getContractAt('IERC20', USDC)

        //     await weth.approve(creditDelegatorLender.address, depositAmount)

        //     const balanceBefore = await usdc.balanceOf(daoLender.address)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     await creditDelegatorLender.borrow(
        //         USDC,
        //         amount,
        //         interestRateMode,
        //         0,
        //         daoLender.address
        //     )

        //     const balanceAfter = await usdc.balanceOf(daoLender.address)

        //     expect(balanceAfter.toNumber()).to.be.equals(balanceBefore.toNumber() + amount)

        // });


        // it('Should borrow using DAO collateral treasury and transfer to beneficiary', async () => {
        //     const depositAmount = ethers.utils.parseUnits("1", "ether")
        //     const amount = 1000
        //     const interestRateMode = 1
        //     const beneficiary = signers[6].address

        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
        //     const usdc = await ethers.getContractAt('IERC20', USDC)

        //     await weth.approve(creditDelegatorLender.address, depositAmount)

        //     const balanceBefore = await usdc.balanceOf(beneficiary)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     await creditDelegatorLender.borrowAndTransfer(
        //         USDC,
        //         amount,
        //         interestRateMode,
        //         0,
        //         daoLender.address,
        //         beneficiary
        //     )

        //     const balanceAfter = await usdc.balanceOf(beneficiary)

        //     expect(balanceBefore).to.be.equals(0)
        //     expect(balanceAfter).to.be.equals(amount)
        //     expect(balanceAfter.toNumber()).to.be.equals(balanceBefore.toNumber() + amount)

        // });

        // it('Should withdrawn funds from treasury', async () => {
        //     const depositAmount = ethers.utils.parseUnits("1", "ether")
        //     const withdrawnAmount = ethers.utils.parseUnits("1", "ether")
        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)

        //     await weth.approve(creditDelegatorLender.address, depositAmount)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     const balanceBefore = await weth.balanceOf(ownerAddress)

        //     await creditDelegatorLender.withdrawn(
        //         WETH_ADDRESS,
        //         withdrawnAmount,
        //         ownerAddress
        //     )

        //     const balanceAfter = await weth.balanceOf(ownerAddress)
        //     expect(balanceBefore.add(withdrawnAmount)).equals(balanceAfter)
        // });

        // it('Should revert withdrawn funds from treasury', async () => {
        //     const depositAmount = ethers.utils.parseUnits("1", "ether")
        //     const withdrawnAmount = ethers.utils.parseUnits("1", "ether")
        //     const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)

        //     await weth.approve(creditDelegatorLender.address, depositAmount)

        //     await creditDelegatorLender.supply(
        //         WETH_ADDRESS,
        //         depositAmount
        //     )

        //     await expect(creditDelegatorLender.connect(signers[1]).withdrawn(
        //         WETH_ADDRESS,
        //         withdrawnAmount,
        //         ownerAddress
        //     )).to.be.revertedWithCustomError(creditDelegatorLender, 'DaoUnauthorized')
        //         .withArgs(
        //             daoLender.address,
        //             creditDelegatorLender.address,
        //             signers[1].address,
        //             WITHDRAWN_AAVE_PERMISSION_ID
        //         );
        // })


        it('Should register credit delegation and execute', async () => {
            const depositAmount = ethers.utils.parseUnits("1", "ether")
            const amount = 1000
            const interestRateMode = 1
            const beneficiary = signers[6].address

            const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
            const usdc = await ethers.getContractAt('IERC20', USDC)

            await weth.approve(creditDelegatorLender.address, depositAmount)

            const balanceBefore = await usdc.balanceOf(beneficiary)

            await creditDelegatorLender.supply(
                WETH_ADDRESS,
                depositAmount
            )

            const iface = CreditDelegator__factory.createInterface()
            const borrownAndtransfer = iface.encodeFunctionData(
                'borrowAndTransfer',
                [
                    USDC,
                    amount,
                    interestRateMode,
                    0,
                    daoLender.address,
                    beneficiary
                ]
            )

            const borrownAndtransferAction: DaoAction = {
                to: creditDelegatorLender.address,
                value: ethers.utils.parseEther('0').toBigInt(),
                data: hexToBytes(borrownAndtransfer)
            }

            await creditDelegatorLender.registerActions(
                daoLender.address,
                [borrownAndtransferAction],
                0
            )

            const pendingActions = await creditDelegatorLender._currentPending()
            expect(pendingActions).to.be.equal(1)

            await creditDelegatorLender.executeActions(0)

            const lastExecuted = await creditDelegatorLender._lastExecuted()
            expect(lastExecuted).to.be.equal(0)

            const balanceAfter = await usdc.balanceOf(beneficiary)

            expect(balanceBefore).to.be.equals(0)
            expect(balanceAfter).to.be.equals(amount)
            expect(balanceAfter.toNumber()).to.be.equals(balanceBefore.toNumber() + amount)
        })
    })
});