import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployNewDAO } from "./utils/dao"
import { getMergedABI } from './utils/abi';
import { deployWithProxy } from './utils/proxy';
import { shouldUpgradeCorrectly } from './utils/uups-upgradeable';
import { UPGRADE_PERMISSIONS } from './utils/permissions';
import { OZ_ERRORS } from './utils/error';


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
            ethers.utils.id('EXECUTE_PERMISSION')
        );

        this.upgrade = {
            contract: creditDelegatorLender,
            dao: daoLender,
            user: signers[8],
        };

    });

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
        it('Deposit 10 WETH in DAO treasury', async () => {

            const depositAmount = ethers.utils.parseUnits("10", "ether")
            await creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS);
            const aavePool = await ethers.getContractAt('IPool', POOL_ADDRESS)

            const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)

            const daoAccountDataBefore = await aavePool.getUserAccountData(daoLender.address)

            await weth.approve(creditDelegatorLender.address, depositAmount)
            await weth.approve(POOL_ADDRESS, depositAmount)

            await creditDelegatorLender.supply(
                WETH_ADDRESS,
                depositAmount
            )

            const daoAccountDataAfter = await aavePool.getUserAccountData(daoLender.address)

            expect(daoAccountDataBefore.totalCollateralBase.toNumber()).to.be.equals(0)
            expect(daoAccountDataAfter.totalCollateralBase.toNumber()).to.be.greaterThan(0)
        });


        it('Should approve delegation', async () => {
            const depositAmount = ethers.utils.parseUnits("10", "ether")
            const amount = 1000
            await creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS);

            const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)

            await weth.approve(creditDelegatorLender.address, depositAmount)

            await creditDelegatorLender.supply(
                WETH_ADDRESS,
                depositAmount
            )

            await creditDelegatorLender.approveDelegation(
                USDC_DEBT_ADDRESS,
                borrowerAddress,
                amount
            )

            const debtToken = await ethers.getContractAt('ICreditDelegationToken', USDC_DEBT_ADDRESS)
            const approvedAmount = await debtToken.borrowAllowance(daoLender.address, borrowerAddress)

            expect(approvedAmount.toNumber()).to.be.equals(approvedAmount)

        });


        it('Should borrow on behalf of Lender', async () => {
            const depositAmount = ethers.utils.parseUnits("10", "ether")
            const amount = 1000
            const interestRateMode = 1
            await creditDelegatorLender.initialize(daoLender.address, POOL_ADDRESS);

            const weth = await ethers.getContractAt('IERC20', WETH_ADDRESS)
            const usdc = await ethers.getContractAt('IERC20', USDC)

            await weth.approve(creditDelegatorLender.address, depositAmount)

            await creditDelegatorLender.supply(
                WETH_ADDRESS,
                depositAmount
            )

            await creditDelegatorLender.approveDelegation(
                USDC_DEBT_ADDRESS,
                borrowerAddress,
                amount
            )

            const aavePool = await ethers.getContractAt('IPool', POOL_ADDRESS)

            const balanceBefore = await usdc.balanceOf(borrowerAddress)

            await aavePool.connect(borrower).borrow(
                USDC,
                amount,
                interestRateMode,
                0,
                daoLender.address
            )

            const balanceAfter = await usdc.balanceOf(borrowerAddress)

            expect(balanceBefore.toNumber()).to.be.equals(0)
            expect(balanceAfter.toNumber()).to.be.equals(amount)

        });
    })
});