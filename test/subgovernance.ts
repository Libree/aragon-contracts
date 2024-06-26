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
    pctToRatio,
    getTime,
    VotingMode,
    ONE_HOUR,
    VoteOption,
} from './utils/voting';

describe('Subgovernance voting plugin', function () {
    let signers: SignerWithAddress[];
    let dao: any;
    let ownerAddress: string;
    let pluginFactoryBytecode: any;
    let mergedAbi: any;
    let votingSettings: any;
    let voting: any;
    let startDate: number;
    const startOffset = 10;
    let dummyActions: any;
    let dummyMetadata: string;
    let endDate: any;


    before(async () => {
        signers = await ethers.getSigners();
        ownerAddress = await signers[0].getAddress();

        ({ abi: mergedAbi, bytecode: pluginFactoryBytecode } = await getMergedABI(
            // @ts-ignore
            hre,
            'Subgovernance',
            ['DAO']
        ));

        dao = await deployNewDAO(ownerAddress);

        dummyActions = [
            {
                to: signers[0].address,
                data: '0x00000000',
                value: 0,
            },
        ];
        dummyMetadata = ethers.utils.hexlify(
            ethers.utils.toUtf8Bytes('0x123456789')
        );
    });

    beforeEach(async function () {
        votingSettings = {
            votingMode: VotingMode.EarlyExecution,
            supportThreshold: pctToRatio(50),
            minParticipation: pctToRatio(20),
            minDuration: ONE_HOUR,
            minProposerVotingPower: 0,
        };

        const GrouplistVotingFactory = new ethers.ContractFactory(
            mergedAbi,
            pluginFactoryBytecode,
            signers[0]
        );

        voting = await deployWithProxy(GrouplistVotingFactory);

        startDate = (await getTime()) + startOffset;
        endDate = startDate + votingSettings.minDuration;

        await dao.grant(
            dao.address,
            voting.address,
            ethers.utils.id('EXECUTE_PERMISSION')
        );
        await dao.grant(
            voting.address,
            ownerAddress,
            ethers.utils.id('UPDATE_ADDRESSES_PERMISSION')
        );

        await dao.grant(
            voting.address,
            ownerAddress,
            ethers.utils.id('CREATE_GROUP_PERMISSION')
        );

        this.upgrade = {
            contract: voting,
            dao: dao,
            user: signers[8],
        };
    });

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: voting,
                dao: dao,
                user: signers[8],
            };
            await voting.initialize(dao.address, votingSettings);
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await voting.initialize(dao.address, votingSettings);

            await expect(
                voting.initialize(dao.address, votingSettings)
            ).to.be.revertedWith(OZ_ERRORS.ALREADY_INITIALIZED);
        });
    });

    describe('Group members: ', async () => {
        beforeEach(async () => {
            await voting.initialize(dao.address, votingSettings);
            await voting.createGroup(
                "NFT collectors",
                []
            )
        });

        it('should return false, if user is not listed', async () => {
            const block1 = await ethers.provider.getBlock('latest');
            await ethers.provider.send('evm_mine', []);
            expect(await voting.getGroupName(0)).to.be.equals("NFT collectors")
            expect(await voting.isListedAtBlock(signers[0].address, 0, block1.number)).to
                .be.false;
        });

        it('should add new users in the group list and emit the `MembersAdded` event', async () => {
            const addresses = [signers[0].address, signers[1].address];
            await expect(voting.addAddresses(addresses, 0))
                .to.emit(voting, 'MembersAdded')
                .withArgs(addresses, 0);

            const block = await ethers.provider.getBlock('latest');
            await ethers.provider.send('evm_mine', []);

            expect(await voting.isListedAtBlock(signers[0].address, 0, block.number)).to
                .be.true;
        });

        it('should remove users from the address list and emit the `MembersRemoved` event', async () => {
            await voting.addAddresses([signers[0].address], 0);

            const block1 = await ethers.provider.getBlock('latest');
            await ethers.provider.send('evm_mine', []);
            expect(await voting.isListedAtBlock(signers[0].address, 0, block1.number)).to
                .be.true;

            await expect(voting.removeAddresses([signers[0].address], 0))
                .to.emit(voting, 'MembersRemoved')
                .withArgs([signers[0].address], 0);

            const block2 = await ethers.provider.getBlock('latest');
            await ethers.provider.send('evm_mine', []);
            expect(await voting.isListedAtBlock(signers[0].address, 0, block2.number)).to
                .be.false;
        });
    });


    describe('Proposal creation', async () => {
        it('reverts if the user is not allowed to create a proposal', async () => {
            votingSettings.minProposerVotingPower = 1;

            await voting.initialize(
                dao.address,
                votingSettings
            );

            const allowedAddressNFT = await signers[0].getAddress()
            const allowedAddressToken = await signers[1].getAddress()

            await voting.createGroup(
                "NFT collectors",
                [allowedAddressNFT]
            )
            await voting.createGroup(
                "Token collectors",
                [allowedAddressToken]
            )

            await expect(
                voting
                    .connect(signers[1])
                    .createProposal(dummyMetadata, [], 0, 0, 0, VoteOption.None, false, 0)
            )
                .to.be.revertedWithCustomError(voting, 'ProposalCreationForbidden')
                .withArgs(signers[1].address);

            await expect(
                voting
                    .connect(signers[0])
                    .createProposal(dummyMetadata, [], 0, 0, 0, VoteOption.None, false, 1)
            )
                .to.be.revertedWithCustomError(voting, 'ProposalCreationForbidden')
                .withArgs(signers[0].address);

            await expect(
                voting
                    .connect(signers[0])
                    .createProposal(dummyMetadata, [], 0, 0, 0, VoteOption.None, false, 0)
            ).not.to.be.reverted;

            await expect(
                voting
                    .connect(signers[1])
                    .createProposal(dummyMetadata, [], 0, 0, 0, VoteOption.None, false, 1)
            ).not.to.be.reverted;
        });


        it('should create a proposal successfully, but not vote', async () => {
            await voting.initialize(
                dao.address,
                votingSettings
            );

            const allowedAddressNFT = await signers[0].getAddress()

            await voting.createGroup(
                "NFT collectors",
                [allowedAddressNFT]
            )

            const allowFailureMap = 1;

            let tx = await voting.createProposal(
                dummyMetadata,
                dummyActions,
                allowFailureMap,
                0,
                0,
                VoteOption.None,
                false,
                0
            );

            await expect(tx)
                .to.emit(voting, 'ProposalCreated')
                .to.not.emit(voting, 'VoteCast');

            const block = await ethers.provider.getBlock('latest');

            const proposal = await voting.getProposal(0);
            expect(proposal.open).to.be.true;
            expect(proposal.executed).to.be.false;
            expect(proposal.allowFailureMap).to.equal(allowFailureMap);
            expect(proposal.parameters.snapshotBlock).to.equal(block.number - 1);
            expect(proposal.parameters.supportThreshold).to.equal(
                votingSettings.supportThreshold
            );
            expect(
                proposal.parameters.startDate.add(votingSettings.minDuration)
            ).to.equal(proposal.parameters.endDate);

            expect(proposal.tally.yes).to.equal(0);
            expect(proposal.tally.no).to.equal(0);

            expect(await voting.canVote(0, signers[0].address, VoteOption.Yes)).to.be
                .true;
            expect(await voting.canVote(0, signers[10].address, VoteOption.Yes)).to
                .be.false;
            expect(await voting.canVote(1, signers[0].address, VoteOption.Yes)).to.be
                .false;

            expect(proposal.actions.length).to.equal(1);
            expect(proposal.actions[0].to).to.equal(dummyActions[0].to);
            expect(proposal.actions[0].value).to.equal(dummyActions[0].value);
            expect(proposal.actions[0].data).to.equal(dummyActions[0].data);
        });


        it('should create a proposal successfully, and vote', async () => {
            await voting.initialize(
                dao.address,
                votingSettings
            );

            const allowedAddressNFT = await signers[0].getAddress()
            const allowedAddressToken = await signers[1].getAddress()

            await voting.createGroup(
                "NFT collectors",
                [allowedAddressNFT]
            )
            await voting.createGroup(
                "Token collectors",
                [allowedAddressToken]
            )

            let txNFT = await voting.createProposal(
                dummyMetadata,
                dummyActions,
                0,
                0,
                0,
                VoteOption.Yes,
                false,
                0
            );

            await expect(txNFT)
                .to.emit(voting, 'ProposalCreated')
                .to.emit(voting, 'VoteCast');

            await expect(voting.connect(signers[1]).vote(0, VoteOption.Yes, false))
                .to.be.revertedWithCustomError(voting, 'VoteCastForbidden')

            let txToken = await voting.connect(signers[1]).createProposal(
                dummyMetadata,
                dummyActions,
                0,
                0,
                0,
                VoteOption.Yes,
                false,
                1
            );

            await expect(txToken)
                .to.emit(voting, 'ProposalCreated')
                .to.emit(voting, 'VoteCast');

            await expect(voting.connect(signers[0]).vote(1, VoteOption.Yes, false))
                .to.be.revertedWithCustomError(voting, 'VoteCastForbidden')

        })
    })
})