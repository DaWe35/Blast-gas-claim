const BLAST_CONTRACT_ADDRESS = '0x4300000000000000000000000000000000000002'
const BLAST_RPC_URL = 'https://rpc.blast.io'
const YIELD_MODES = ['Automatic', 'Void', 'Claimable']
const GAS_MODES = ['Void', 'Claimable']
const ETH_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
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
}

// Add cache-related constants at the top with other constants
const ETH_PRICE_CACHE_DURATION = 60 * 1000; // 1 minute in milliseconds

// Contract state management
const state = {
    provider: new ethers.JsonRpcProvider(BLAST_RPC_URL),
    contract: null,
    currentAddress: '',
    ethPrice: null,
    ethPriceLastFetch: null  // Timestamp of last ETH price fetch
}

// Utility functions
const utils = {
    async getEthPrice() {
        const now = Date.now()
        
        // Return cached price if it's still valid
        if (state.ethPrice && state.ethPriceLastFetch && 
            (now - state.ethPriceLastFetch) < ETH_PRICE_CACHE_DURATION) {
            return state.ethPrice
        }

        try {
            const response = await fetch(ETH_PRICE_API)
            const data = await response.json()
            
            // Update cache
            state.ethPrice = data.ethereum.usd
            state.ethPriceLastFetch = now
            
            return state.ethPrice
        } catch (error) {
            console.error('Error fetching ETH price:', error)
            return null
        }
    },

    getSignificantDecimals(value) {
        if (value === 0) return 0
        if (value >= 1000) return 0
        if (value >= 1) return 2
        const decimals = -Math.floor(Math.log10(value)) + 2
        return Math.min(decimals, 18); // Cap at 18 decimals (ETH's max precision)
    },

    formatNumber(value, includeDecimals = true) {
        if (!includeDecimals) return value.toString()
        const decimals = this.getSignificantDecimals(value)
        return value.toFixed(decimals)
    },

    formatEthAndUsd(ethAmount, ethPrice) {
        const ethValue = parseFloat(ethers.formatEther(ethAmount))
        const usdValue = ethPrice ? (ethValue * ethPrice) : null
        
        const formattedEth = this.formatNumber(ethValue)
        const formattedUsd = usdValue ? this.formatNumber(usdValue) : null

        return usdValue 
            ? `${formattedEth} ETH ($${formattedUsd} USD)`
            : `${formattedEth} ETH`
    },

    formatChartValue(ethValue, usdValue) {
        const formattedEth = this.formatNumber(ethValue)
        const formattedUsd = usdValue ? this.formatNumber(usdValue) : null

        return `${formattedEth} ETH${
            usdValue ? ` ($${formattedUsd})` : ''
        }`
    },

    async initContract() {
        const response = await fetch('./contracts/abi/Blast.json')
        const abi = await response.json()
        return new ethers.Contract(BLAST_CONTRACT_ADDRESS, abi, state.provider)
    },

    isValidAddress(address) {
        return ethers.isAddress(address)
    },

    timeAgo(timestamp) {
        const seconds = Math.floor(Date.now() / 1000 - timestamp)
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        }
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit)
            if (interval >= 1) {
                return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`
            }
        }
        
        return 'just now'
    }
}

// UI update functions
const ui = {
    showError(message) {
        console.error(message)
        alert(message)
    },

    updateYieldConfig(mode) {
        elem('#yieldConfig').textContent = `Mode: ${mode}`
    },

    updateGasParams(params, ethPrice) {
        const { lastUpdated, gasMode } = params
        const fullDate = new Date(lastUpdated * 1000).toLocaleString()
        const timeAgoStr = utils.timeAgo(lastUpdated)
        
        elem('#gasParamsLastUpdate').textContent = `Last Balance Change: ${timeAgoStr}`
        elem('#gasParamsLastUpdate').title = fullDate
        elem('#gasParamsMode').textContent = `Gas Mode: ${GAS_MODES[gasMode]}`
    },

    updateClaimableYield(amount, ethPrice) {
        elem('#claimableYield').textContent = 
            `Claimable yield: ${utils.formatEthAndUsd(amount, ethPrice)}`
    },

    showResults(show) {
        elem('.results-section').style.display = show ? 'block' : 'none'
    },

    drawGasChart(params, claimRate) {
        const totalBalance = ethers.getBigInt(params.etherBalance)
        const maturedBalance = ethers.getBigInt(params.etherMonths)
        const earlyClaimable = (totalBalance * ethers.getBigInt(Math.floor(claimRate * 100))) / ethers.getBigInt(100)
        
        // Convert to regular numbers for easier calculation
        const total = parseFloat(ethers.formatEther(totalBalance))
        const matured = parseFloat(ethers.formatEther(maturedBalance))
        const early = parseFloat(ethers.formatEther(earlyClaimable))
        
        // Calculate USD values
        const totalUsd = state.ethPrice ? (total * state.ethPrice) : null
        const maturedUsd = state.ethPrice ? (matured * state.ethPrice) : null
        const earlyUsd = state.ethPrice ? (early * state.ethPrice) : null
        
        // Update bar widths and values
        const maturedPercent = (matured / total * 100).toFixed(2)
        const earlyPercent = (early / total * 100).toFixed(2)
        
        // Update total value
        elem('.chart-bar-total .chart-value').textContent = 
            utils.formatChartValue(total, totalUsd)
        
        // Update matured bar
        const maturedBar = elem('.chart-bar-matured')
        maturedBar.style.width = `${maturedPercent}%`
        maturedBar.querySelector('.chart-value').textContent = 
            utils.formatChartValue(matured, maturedUsd)
        
        // Update early claimable bar
        const earlyBar = elem('.chart-bar-early')
        earlyBar.style.width = `${earlyPercent}%`
        earlyBar.querySelector('.chart-value').textContent = 
            utils.formatChartValue(early, earlyUsd)
    },

    async updateGasClaimInfo(params, ethPrice) {
        const { claimRate, lossRate } = await contractActions.calculateClaimRates(params)
        
        const etherBalance = ethers.getBigInt(params.etherBalance)
        const potentialLoss = (etherBalance * ethers.getBigInt(Math.floor(lossRate * 100))) / ethers.getBigInt(100)

        elem('#gasClaimLoss').textContent = 
            `Potential loss if early claimed: ${utils.formatEthAndUsd(potentialLoss.toString(), ethPrice)} (${(lossRate * 100).toFixed(1)}%)`
        elem('#gasMaturityTime').textContent = 
            `Time until full maturity: ${this.formatTimeRemaining(params.lastUpdated)}`
        
        // Draw the chart
        this.drawGasChart(params, claimRate)
    },

    formatTimeRemaining(lastUpdated) {
        const now = Math.floor(Date.now() / 1000)
        const maturityDate = Number(lastUpdated) + (30 * 24 * 60 * 60); // 30 days in seconds
        const remainingSeconds = Math.max(0, maturityDate - now)
        
        if (remainingSeconds === 0) return 'Fully matured'
        
        // If maturity date is in the past
        if (maturityDate < now) return 'Fully matured'
        
        const days = Math.floor(remainingSeconds / (24 * 60 * 60))
        const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60))
        
        return `${days}d ${hours}h`
    },

    setLoading(button, isLoading, options = {}) {
        const defaultText = button.getAttribute('data-default-text') || button.textContent
        const loadingText = options.loadingText || 'Loading...'
        
        if (isLoading) {
            if (!button.hasAttribute('data-default-text')) {
                button.setAttribute('data-default-text', defaultText)
            }
            button.classList.add('loading')
            button.disabled = true
            button.textContent = loadingText
        } else {
            button.classList.remove('loading')
            button.disabled = false
            button.textContent = button.getAttribute('data-default-text') || defaultText
        }
    }
}

// Web3 interaction functions
const web3Actions = {
    async checkAndSwitchChain() {
        if (!window.ethereum) {
            throw new Error('Please install a web3 wallet to perform this action')
        }

        const currentChainId = await window.ethereum.request({ 
            method: 'eth_chainId' 
        })

        if (currentChainId !== BLAST_CHAIN_ID) {
            try {
                // Try to switch to Blast chain
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BLAST_CHAIN_ID }],
                })
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [BLAST_CHAIN_CONFIG],
                        })
                    } catch (addError) {
                        throw new Error('Failed to add Blast network to your wallet')
                    }
                } else {
                    throw new Error('Failed to switch to Blast network')
                }
            }
        }
    },

    async connectWallet() {
        if (!window.ethereum) {
            throw new Error('Please install a web3 wallet to perform this action (Rabby wallet is recommended)')
        }
        
        await this.checkAndSwitchChain()
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        })
        return accounts[0]
    },

    async getContractWithSigner() {
        await this.checkAndSwitchChain()
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const response = await fetch('./contracts/abi/Blast.json')
        const abi = await response.json()
        return new ethers.Contract(BLAST_CONTRACT_ADDRESS, abi, signer)
    }
}

// Contract interaction functions
const contractActions = {
    async fetchContractData(address) {
        const contract = state.contract
        const yieldConfig = await contract.readYieldConfiguration(address)
        const gasParams = await contract.readGasParams(address)
        const claimableYield = await contract.readClaimableYield(address)

        // Convert BigInt to string before calculations
        const etherSeconds = gasParams[0].toString()
        const etherBalance = gasParams[1].toString()
        const lastUpdated = Number(gasParams[2]); // This one is safe to convert to number
        const gasMode = Number(gasParams[3]); // This one is safe to convert to number

        return {
            yieldMode: YIELD_MODES[yieldConfig],
            claimableYield: claimableYield.toString(), // Convert BigInt to string
            gasParams: {
                etherSeconds,
                etherBalance,
                lastUpdated,
                gasMode,
                // Calculate etherMonths using BigInt operations
                etherMonths: (ethers.getBigInt(etherSeconds) * ethers.getBigInt(1) / 
                    ethers.getBigInt(30 * 24 * 60 * 60)).toString()
            }
        }
    },

    async claimYield() {
        try {
            const userAddress = await web3Actions.connectWallet()
            const contractWithSigner = await web3Actions.getContractWithSigner()

            const tx = await contractWithSigner.claimAllYield(state.currentAddress, userAddress)
            await tx.wait()

            ui.showError('Yield claimed successfully!')
            await checkContract(); // Refresh data
        } catch (error) {
            if (!error.message.includes('User rejected') && !error.message.includes('user rejected')) {
                ui.showError('Error claiming yield: ' + error.message)
            }
        }
    },

    async claimAllGas() {
        try {
            const userAddress = await web3Actions.connectWallet()
            const contractWithSigner = await web3Actions.getContractWithSigner()
            
            // Fetch latest gas params
            const data = await contractActions.fetchContractData(state.currentAddress)
            const gasParams = data.gasParams
            
            // Calculate potential loss
            const { lossRate } = await contractActions.calculateClaimRates(gasParams)
            const etherBalance = ethers.getBigInt(gasParams.etherBalance)
            
            if (etherBalance === 0n) {
                ui.showError('No gas balance available to claim')
                return
            }
            
            const potentialLoss = (etherBalance * ethers.getBigInt(Math.floor(lossRate * 100))) / ethers.getBigInt(100)
            
            // Show confirmation with potential loss
            const lossInEthAndUsd = utils.formatEthAndUsd(potentialLoss.toString(), state.ethPrice)
            const confirmed = window.confirm(
                `WARNING: Early claiming will result in a loss of ${lossInEthAndUsd} ` +
                `(${(lossRate * 100).toFixed(1)}% of your gas balance)\n\n` +
                `Are you sure you want to proceed with early claiming?`
            )
            
            if (!confirmed) {
                return
            }

            // Perform the claim
            const tx = await contractWithSigner.claimAllGas(state.currentAddress, userAddress)
            await tx.wait()

            ui.showError('Gas claimed successfully!')
            await checkContract()
        } catch (error) {
            if (!error.message.includes('User rejected') && !error.message.includes('user rejected')) {
                ui.showError('Error claiming gas: ' + error.message)
            }
        }
    },

    async claimMaxGas() {
        try {
            const userAddress = await web3Actions.connectWallet()
            const contractWithSigner = await web3Actions.getContractWithSigner()

            const tx = await contractWithSigner.claimMaxGas(state.currentAddress, userAddress)
            await tx.wait()

            ui.showError('Matured gas claimed successfully!')
            await checkContract()
        } catch (error) {
            if (!error.message.includes('User rejected') && !error.message.includes('user rejected')) {
                ui.showError('Error claiming matured gas: ' + error.message)
            }
        }
    },

    async calculateClaimRates(gasParams) {
        const now = Math.floor(Date.now() / 1000)
        
        // Constants from Blast documentation
        const MATURITY_PERIOD = 30 * 24 * 60 * 60
        const MIN_CLAIM_RATE = 0.5
        const MAX_CLAIM_RATE = 1.0
        
        // Convert from wei to ether using string inputs
        const etherBalance = parseFloat(ethers.formatEther(gasParams.etherBalance))
        const etherSeconds = parseFloat(ethers.formatEther(gasParams.etherSeconds))
        
        if (etherBalance <= 0) {
            return { claimRate: 0, lossRate: 0 }
        }
        
        // Calculate average age of gas fees in seconds
        // etherSeconds / etherBalance gives us the weighted average time
        const averageAge = etherSeconds / etherBalance
        
        // Calculate claim rate based on average age
        let claimRate
        if (averageAge >= MATURITY_PERIOD) {
            claimRate = MAX_CLAIM_RATE
        } else {
            // Linear interpolation from MIN_CLAIM_RATE to MAX_CLAIM_RATE
            const maturityProgress = Math.min(averageAge / MATURITY_PERIOD, 1)
            claimRate = MIN_CLAIM_RATE + (MAX_CLAIM_RATE - MIN_CLAIM_RATE) * maturityProgress
        }
        
        const lossRate = MAX_CLAIM_RATE - claimRate
        
        return { 
            claimRate,
            lossRate,
            averageAge: Math.floor(averageAge)
        }
    }
}

// Main function to check contract
async function checkContract() {
    const button = elem('#checkContract')
    const address = elem('#contractAddress').value
    
    if (!utils.isValidAddress(address)) {
        ui.showError('Please enter a valid Ethereum address')
        return
    }

    try {
        ui.setLoading(button, true)

        state.currentAddress = address
        state.contract = state.contract || await utils.initContract()
        state.ethPrice = await utils.getEthPrice()
        
        const data = await contractActions.fetchContractData(address)
        
        ui.updateYieldConfig(data.yieldMode)
        ui.updateGasParams(data.gasParams, state.ethPrice)
        ui.updateClaimableYield(data.claimableYield, state.ethPrice)
        await ui.updateGasClaimInfo(data.gasParams, state.ethPrice)
        ui.showResults(true)
    } catch (error) {
        ui.showError('Error fetching contract data: ' + error.message)
    } finally {
        ui.setLoading(button, false)
    }
}

// Initialize event listeners
function init() {
    elem('#checkContract').addEventListener('click', checkContract)
    elem('#claimYieldBtn').addEventListener('click', contractActions.claimYield)
    elem('#claimAllGasBtn').addEventListener('click', contractActions.claimAllGas)
    elem('#claimMaxGasBtn').addEventListener('click', contractActions.claimMaxGas)
}

window.addEventListener('load', init); 