const BLAST_CONTRACT_ADDRESS = '0x4300000000000000000000000000000000000002';
const BLAST_RPC_URL = 'https://rpc.blast.io';
const YIELD_MODES = ['Automatic', 'Void', 'Claimable'];
const GAS_MODES = ['Void', 'Claimable'];
const ETH_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const BLAST_CHAIN_ID = '0x13e31';  // 81457 in decimal
const BLAST_CHAIN_CONFIG = {
    chainId: BLAST_CHAIN_ID,
    chainName: 'Blast Mainnet',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: [BLAST_RPC_URL],
    blockExplorerUrls: ['https://blastscan.io']
};

// Contract state management
const state = {
    web3: new Web3(new Web3.providers.HttpProvider(BLAST_RPC_URL)),
    contract: null,
    currentAddress: '',
    ethPrice: null
};

// Utility functions
const utils = {
    async getEthPrice() {
        try {
            const response = await fetch(ETH_PRICE_API);
            const data = await response.json();
            return data.ethereum.usd;
        } catch (error) {
            console.error('Error fetching ETH price:', error);
            return null;
        }
    },

    formatEthAndUsd(ethAmount, ethPrice) {
        const ethValue = parseFloat(state.web3.utils.fromWei(ethAmount, 'ether'));
        const usdValue = ethPrice ? (ethValue * ethPrice).toFixed(2) : null;
        return usdValue 
            ? `${ethValue.toFixed(6)} ETH ($${usdValue} USD)`
            : `${ethValue.toFixed(6)} ETH`;
    },

    async initContract() {
        const response = await fetch('./contracts/abi/Blast.json');
        const abi = await response.json();
        return new state.web3.eth.Contract(abi, BLAST_CONTRACT_ADDRESS);
    },

    isValidAddress(address) {
        return state.web3.utils.isAddress(address);
    }
};

// UI update functions
const ui = {
    showError(message) {
        console.error(message);
        alert(message);
    },

    updateYieldConfig(mode) {
        elem('#yieldConfig').textContent = `Mode: ${mode}`;
    },

    updateGasParams(params, ethPrice) {
        const { etherBalance, lastUpdated, etherMonths, gasMode } = params;
        elem('#gasParamsBalance').textContent = 
            `Gas Balance: ${utils.formatEthAndUsd(etherBalance, ethPrice)}`;
        elem('#gasParamsLastUpdate').textContent = 
            `Last Changed: ${new Date(lastUpdated * 1000).toLocaleString()}`;
        elem('#gasParamsGasMonths').textContent = 
            `Claimable Matured Gas: ${utils.formatEthAndUsd(etherMonths, ethPrice)}`;
        elem('#gasParamsMode').textContent = `Gas Mode: ${GAS_MODES[gasMode]}`;
    },

    updateClaimableYield(amount, ethPrice) {
        elem('#claimableYield').textContent = 
            `Claimable yield: ${utils.formatEthAndUsd(amount, ethPrice)}`;
    },

    showResults(show) {
        elem('.results-section').style.display = show ? 'block' : 'none';
    },

    async updateGasClaimInfo(params, ethPrice) {
        const { claimRate, lossRate } = await contractActions.calculateClaimRates(params);
        
        const etherBalance = state.web3.utils.toBN(params.etherBalance);
        const maxClaimable = etherBalance.muln(Math.floor(claimRate * 100)).divn(100);
        const potentialLoss = etherBalance.muln(Math.floor(lossRate * 100)).divn(100);

        elem('#gasClaimableNow').textContent = 
            `Maximum claimable now: ${utils.formatEthAndUsd(maxClaimable, ethPrice)}`;
        elem('#gasClaimLoss').textContent = 
            `Potential loss if claimed now: ${utils.formatEthAndUsd(potentialLoss, ethPrice)} (${(lossRate * 100).toFixed(1)}%)`;
        elem('#gasMaturityTime').textContent = 
            `Time until full maturity: ${this.formatTimeRemaining(params.lastUpdated)}`;
    },

    formatTimeRemaining(lastUpdated) {
        const now = Math.floor(Date.now() / 1000);
        const maturityDate = Number(lastUpdated) + (30 * 24 * 60 * 60); // 30 days in seconds
        const remainingSeconds = Math.max(0, maturityDate - now);
        
        if (remainingSeconds === 0) return 'Fully matured';
        
        // If maturity date is in the past
        if (maturityDate < now) return 'Fully matured';
        
        const days = Math.floor(remainingSeconds / (24 * 60 * 60));
        const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60));
        
        return `${days}d ${hours}h`;
    }
};

// Web3 interaction functions
const web3Actions = {
    async checkAndSwitchChain() {
        if (!window.ethereum) {
            throw new Error('Please install ck to perform this action');
        }

        const currentChainId = await window.ethereum.request({ 
            method: 'eth_chainId' 
        });

        if (currentChainId !== BLAST_CHAIN_ID) {
            try {
                // Try to switch to Blast chain
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BLAST_CHAIN_ID }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [BLAST_CHAIN_CONFIG],
                        });
                    } catch (addError) {
                        throw new Error('Failed to add Blast network to MetaMask');
                    }
                } else {
                    throw new Error('Failed to switch to Blast network');
                }
            }
        }
    },

    async connectWallet() {
        if (!window.ethereum) {
            throw new Error('Please install MetaMask to perform this action');
        }
        
        await this.checkAndSwitchChain();
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        return accounts[0];
    },

    async getContractWithSigner() {
        await this.checkAndSwitchChain();
        const web3Instance = new Web3(window.ethereum);
        const response = await fetch('./contracts/abi/Blast.json');
        const abi = await response.json();
        return new web3Instance.eth.Contract(abi, BLAST_CONTRACT_ADDRESS);
    }
};

// Contract interaction functions
const contractActions = {
    async fetchContractData(address) {
        const contract = state.contract;
        const yieldConfig = await contract.methods.readYieldConfiguration(address).call();
        const gasParams = await contract.methods.readGasParams(address).call();
        const claimableYield = await contract.methods.readClaimableYield(address).call();

        return {
            yieldMode: YIELD_MODES[yieldConfig],
            claimableYield,
            gasParams: {
                etherSeconds: gasParams[0],
                etherBalance: gasParams[1],
                lastUpdated: gasParams[2],
                gasMode: gasParams[3],
                etherMonths: state.web3.utils.toBN(gasParams[0])
                    .div(state.web3.utils.toBN(30 * 24 * 60 * 60))
            }
        };
    },

    async claimYield() {
        try {
            const userAddress = await web3Actions.connectWallet();
            const contractWithSigner = await web3Actions.getContractWithSigner();

            await contractWithSigner.methods
                .claimAllYield(state.currentAddress, userAddress)
                .send({ from: userAddress });

            ui.showError('Yield claimed successfully!');
            await checkContract(); // Refresh data
        } catch (error) {
            ui.showError('Error claiming yield: ' + error.message);
        }
    },

    async claimAllGas() {
        try {
            const userAddress = await web3Actions.connectWallet();
            const contractWithSigner = await web3Actions.getContractWithSigner();

            await contractWithSigner.methods
                .claimAllGas(state.currentAddress, userAddress)
                .send({ from: userAddress });

            ui.showError('Gas claimed successfully!');
            await checkContract(); // Refresh data
        } catch (error) {
            ui.showError('Error claiming gas: ' + error.message);
        }
    },

    async claimMaxGas() {
        try {
            const userAddress = await web3Actions.connectWallet();
            const contractWithSigner = await web3Actions.getContractWithSigner();

            await contractWithSigner.methods
                .claimMaxGas(state.currentAddress, userAddress)
                .send({ from: userAddress });

            ui.showError('Matured gas claimed successfully!');
            await checkContract(); // Refresh data
        } catch (error) {
            ui.showError('Error claiming matured gas: ' + error.message);
        }
    },

    async calculateClaimRates(gasParams) {
        // Current timestamp in seconds
        const now = Math.floor(Date.now() / 1000);
        const timeElapsed = now - gasParams.lastUpdated;
        
        // Based on Blast docs: 30 day maturity period, 50% initial rate to 100% final rate
        const MATURITY_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
        const MIN_CLAIM_RATE = 0.5; // 50%
        
        if (timeElapsed >= MATURITY_PERIOD) {
            return { claimRate: 1, lossRate: 0 }; // Fully matured
        }

        const claimRate = MIN_CLAIM_RATE + ((1 - MIN_CLAIM_RATE) * timeElapsed / MATURITY_PERIOD);
        const lossRate = 1 - claimRate;
        
        return { claimRate, lossRate };
    }
};

// Main function to check contract
async function checkContract() {
    const address = elem('#contractAddress').value;
    if (!utils.isValidAddress(address)) {
        ui.showError('Please enter a valid Ethereum address');
        return;
    }

    state.currentAddress = address;
    state.contract = state.contract || await utils.initContract();
    state.ethPrice = await utils.getEthPrice();
    
    try {
        const data = await contractActions.fetchContractData(address);
        
        ui.updateYieldConfig(data.yieldMode);
        ui.updateGasParams(data.gasParams, state.ethPrice);
        ui.updateClaimableYield(data.claimableYield, state.ethPrice);
        await ui.updateGasClaimInfo(data.gasParams, state.ethPrice);
        ui.showResults(true);
    } catch (error) {
        ui.showError('Error fetching contract data: ' + error.message);
    }
}

// Initialize event listeners
function init() {
    elem('#checkContract').addEventListener('click', checkContract);
    elem('#claimYieldBtn').addEventListener('click', contractActions.claimYield);
    elem('#claimAllGasBtn').addEventListener('click', contractActions.claimAllGas);
    elem('#claimMaxGasBtn').addEventListener('click', contractActions.claimMaxGas);
}

window.addEventListener('load', init); 